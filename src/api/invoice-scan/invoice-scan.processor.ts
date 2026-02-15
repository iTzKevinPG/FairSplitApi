import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { INVOICE_SCAN_JOB } from './invoice-scan.constants';
import { S3Service } from '../../infra/storage/s3.service';
import { InvoiceScanResultService } from './invoice-scan-result.service';
import type { ParsedInvoice, ScanJobPayload, ConfidenceSummary } from './processor/types';
import {
  buildConfidenceSummary,
  isHighConfidenceForLowPass,
  isLowConfidence,
} from './processor/confidence';
import { validateAndNormalize } from './processor/normalize';
import {
  extractTextFromOcrSpace,
  parseInvoiceFromImageWithOpenAI,
  parseInvoiceFromOcrTextWithOpenAI,
  toOneLineErrorMessage,
} from './processor/clients';
import { downloadImageBuffer, preprocessImageForVision, toDataUrl } from './processor/image';

@Injectable()
export class InvoiceScanProcessor {
  constructor(
    private readonly _s3Service: S3Service,
    private readonly _results: InvoiceScanResultService,
  ) {}

  async process(job: Job<ScanJobPayload>): Promise<unknown> {
    if (job.name !== INVOICE_SCAN_JOB) {
      return null;
    }

    const ocrKey = process.env.OCRSPACE_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      throw new Error('Missing OpenAI credentials');
    }

    const startTime = Date.now();
    try {
      await job.updateProgress(10);

      const signedUrl = await this._s3Service.getSignedUrl({
        key: job.data.imageKey,
        expiresInSeconds: Number(process.env.S3_SIGNED_URL_TTL_SECONDS ?? 3600),
      });

      const timings: Record<string, number> = {};
      let visionImageInput = signedUrl;
      let ocrTextLength = 0;
      let strategy = 'vision_low';
      let normalized: ParsedInvoice | null = null;
      let confidence: ConfidenceSummary | null = null;
      const pipelineWarnings: string[] = [];
      const attemptErrors: Array<{ stage: string; message: string }> = [];

      const preprocessStart = Date.now();
      try {
        console.info('invoice_scan_stage_start', {
          jobId: job.id,
          stage: 'preprocess_image',
          eventId: job.data.eventId,
        });
        const originalBuffer = await downloadImageBuffer(signedUrl);
        const preprocessedBuffer = await preprocessImageForVision(originalBuffer);
        visionImageInput = toDataUrl(preprocessedBuffer, 'image/jpeg');
        timings.preprocessMs = Date.now() - preprocessStart;
      } catch (error) {
        timings.preprocessMs = Date.now() - preprocessStart;
        const message = toOneLineErrorMessage(error);
        attemptErrors.push({ stage: 'preprocess_image', message: message.slice(0, 300) });
        pipelineWarnings.push('Image preprocessing failed; using original image.');
        console.warn('invoice_scan_stage_failed', {
          jobId: job.id,
          stage: 'preprocess_image',
          eventId: job.data.eventId,
          error: message,
        });
      }

      const lowStart = Date.now();
      console.info('invoice_scan_stage_start', {
        jobId: job.id,
        stage: 'vision_low',
        eventId: job.data.eventId,
      });
      try {
        const lowParsed = await parseInvoiceFromImageWithOpenAI(openAiKey, visionImageInput, 'low');
        timings.visionLowMs = Date.now() - lowStart;
        const lowNormalized = validateAndNormalize(lowParsed, job.data.eventCurrency);
        const lowConfidence = buildConfidenceSummary(lowNormalized);

        if (
          !isLowConfidence(lowNormalized, lowConfidence) &&
          isHighConfidenceForLowPass(lowConfidence, lowNormalized)
        ) {
          normalized = lowNormalized;
          confidence = lowConfidence;
          strategy = 'vision_low';
        } else {
          pipelineWarnings.push(
            `Low detail confidence too low (score=${lowConfidence.overall.toFixed(2)}). Retrying with high detail.`,
          );
        }
      } catch (error) {
        timings.visionLowMs = Date.now() - lowStart;
        const message = toOneLineErrorMessage(error);
        console.warn('invoice_scan_stage_failed', {
          jobId: job.id,
          stage: 'vision_low',
          eventId: job.data.eventId,
          error: message,
        });
        attemptErrors.push({ stage: 'vision_low', message: message.slice(0, 300) });
        pipelineWarnings.push('Low detail failed; escalated to high detail.');
      }

      await job.updateProgress(40);

      if (!normalized) {
        const highStart = Date.now();
        console.info('invoice_scan_stage_start', {
          jobId: job.id,
          stage: 'vision_high',
          eventId: job.data.eventId,
        });
        try {
          const highParsed = await parseInvoiceFromImageWithOpenAI(
            openAiKey,
            visionImageInput,
            'high',
          );
          timings.visionHighMs = Date.now() - highStart;
          const highNormalized = validateAndNormalize(highParsed, job.data.eventCurrency);
          const highConfidence = buildConfidenceSummary(highNormalized);

          if (!isLowConfidence(highNormalized, highConfidence)) {
            normalized = highNormalized;
            confidence = highConfidence;
            strategy = 'vision_high';
          } else {
            pipelineWarnings.push(
              `High detail confidence still low (score=${highConfidence.overall.toFixed(2)}). Using OCR fallback.`,
            );
          }
        } catch (error) {
          timings.visionHighMs = Date.now() - highStart;
          const message = toOneLineErrorMessage(error);
          console.warn('invoice_scan_stage_failed', {
            jobId: job.id,
            stage: 'vision_high',
            eventId: job.data.eventId,
            error: message,
          });
          attemptErrors.push({ stage: 'vision_high', message: message.slice(0, 300) });
          pipelineWarnings.push('High detail failed; trying OCR fallback.');
        }
      }

      await job.updateProgress(70);

      if (!normalized && ocrKey) {
        strategy = 'ocr_fallback';
        console.info('invoice_scan_stage_start', {
          jobId: job.id,
          stage: 'ocr_fallback',
          eventId: job.data.eventId,
        });
        const ocrStart = Date.now();
        const ocrText = await extractTextFromOcrSpace(ocrKey, visionImageInput);
        timings.ocrMs = Date.now() - ocrStart;
        ocrTextLength = ocrText.length;

        const llmFromOcrStart = Date.now();
        const ocrParsed = await parseInvoiceFromOcrTextWithOpenAI(openAiKey, ocrText);
        timings.ocrLlmMs = Date.now() - llmFromOcrStart;

        normalized = validateAndNormalize(ocrParsed, job.data.eventCurrency);
        confidence = buildConfidenceSummary(normalized);
      }

      if (!normalized) {
        const highRetryStart = Date.now();
        console.info('invoice_scan_stage_start', {
          jobId: job.id,
          stage: 'vision_high_retry',
          eventId: job.data.eventId,
        });
        const highParsed = await parseInvoiceFromImageWithOpenAI(
          openAiKey,
          visionImageInput,
          'high',
        );
        timings.visionHighRetryMs = Date.now() - highRetryStart;
        normalized = validateAndNormalize(highParsed, job.data.eventCurrency);
        confidence = buildConfidenceSummary(normalized);
        strategy = 'vision_high_low_confidence';
        pipelineWarnings.push(
          `Returned best-effort result with low confidence (score=${confidence.overall.toFixed(2)}).`,
        );
      }

      await job.updateProgress(90);

      const totalMs = Date.now() - startTime;
      const warnings = [...(normalized.warnings ?? []), ...pipelineWarnings];
      const result = {
        ...normalized,
        warnings,
        meta: {
          eventId: job.data.eventId,
          userId: job.data.userId,
          imageKey: job.data.imageKey,
          strategy,
          confidence,
          attemptErrors: attemptErrors.length > 0 ? attemptErrors : undefined,
          timings: {
            ...timings,
            totalMs,
          },
        },
      };

      if (job.id) {
        await this._results.set(job.id.toString(), result);
      }

      await job.updateProgress(100);
      console.info('invoice_scan_completed', {
        jobId: job.id,
        eventId: job.data.eventId,
        userId: job.data.userId,
        imageKey: job.data.imageKey,
        contentType: job.data.contentType,
        eventCurrency: job.data.eventCurrency ?? null,
        strategy,
        confidence,
        ocrTextLength,
        itemsCount: result.items?.length ?? 0,
        warningsCount: result.warnings?.length ?? 0,
        ...timings,
        totalMs,
      });

      return result;
    } catch (error) {
      console.warn('invoice_scan_failed', {
        jobId: job.id,
        eventId: job.data.eventId,
        userId: job.data.userId,
        imageKey: job.data.imageKey,
        contentType: job.data.contentType,
        eventCurrency: job.data.eventCurrency ?? null,
        message: (error as Error).message,
      });
      throw error;
    }
  }
}
