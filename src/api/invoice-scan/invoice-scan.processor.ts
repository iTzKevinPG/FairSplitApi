import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { INVOICE_SCAN_JOB, INVOICE_SCAN_QUEUE } from './invoice-scan.constants';
import { S3Service } from '../../infra/storage/s3.service';
import { InvoiceScanResultService } from './invoice-scan-result.service';

type ParsedItem = {
  name: string;
  unitPrice: number;
  quantity: number;
};

type ParsedInvoice = {
  description: string;
  subtotal: number | null;
  tipAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  date: string | null;
  items: ParsedItem[];
  warnings: string[];
  source: { ocr: string; model: string };
};

@Injectable()
@Processor(INVOICE_SCAN_QUEUE)
export class InvoiceScanProcessor extends WorkerHost {
  constructor(
    private readonly _s3Service: S3Service,
    private readonly _results: InvoiceScanResultService,
  ) {
    super();
  }

  async process(
    job: Job<{
      eventId: string;
      userId: string;
      imageKey: string;
      contentType: string;
      eventCurrency?: string;
    }>,
  ): Promise<unknown> {
    if (job.name !== INVOICE_SCAN_JOB) {
      return null;
    }
    const ocrKey = process.env.OCRSPACE_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!ocrKey || !openAiKey) {
      throw new Error('Missing OCR or OpenAI credentials');
    }

    const startTime = Date.now();
    try {
      await job.updateProgress(10);

      const signedUrl = await this._s3Service.getSignedUrl({
        key: job.data.imageKey,
        expiresInSeconds: Number(process.env.S3_SIGNED_URL_TTL_SECONDS ?? 3600),
      });

      const ocrStart = Date.now();
      const ocrText = await this.extractTextFromOcrSpace(ocrKey, signedUrl);
      const ocrMs = Date.now() - ocrStart;
      await job.updateProgress(55);

      const llmStart = Date.now();
      const parsed = await this.parseInvoiceWithOpenAI(openAiKey, ocrText);
      const llmMs = Date.now() - llmStart;
      await job.updateProgress(90);

      const normalized = this.validateAndNormalize(parsed, job.data.eventCurrency);
      const totalMs = Date.now() - startTime;
      const warningsCount = normalized.warnings?.length ?? 0;
      const itemsCount = normalized.items?.length ?? 0;
      const result = {
        ...normalized,
        source: { ocr: 'ocr.space', model: 'gpt-4o-mini' },
        meta: {
          eventId: job.data.eventId,
          userId: job.data.userId,
          imageKey: job.data.imageKey,
          timings: { ocrMs, llmMs, totalMs },
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
        ocrTextLength: ocrText.length,
        itemsCount,
        warningsCount,
        ocrMs,
        llmMs,
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

  private async extractTextFromOcrSpace(apiKey: string, url: string) {
    const body = new URLSearchParams({
      apikey: apiKey,
      url,
      language: 'spa',
      isOverlayRequired: 'false',
      OCREngine: '2',
    });

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new Error(`OCR request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (payload.IsErroredOnProcessing) {
      const message = Array.isArray(payload.ErrorMessage)
        ? payload.ErrorMessage.join(', ')
        : payload.ErrorMessage ?? 'OCR failed';
      throw new Error(message);
    }

    const text = payload.ParsedResults?.map((r) => r.ParsedText ?? '').join('\n') ?? '';
    if (!text.trim()) {
      throw new Error('OCR returned empty text');
    }
    return text;
  }

  private async parseInvoiceWithOpenAI(apiKey: string, rawText: string): Promise<ParsedInvoice> {
    const system = [
      'You extract invoice data from OCR text.',
      'Return JSON only, no markdown.',
      'Use null when a field is not present.',
    ].join(' ');

    const user = [
      'Extract fields:',
      '- description (merchant or restaurant name)',
      '- subtotal, tipAmount, totalAmount (numbers)',
      '- currency (ISO or symbol if present)',
      '- date (YYYY-MM-DD if present)',
      '- items: array of { name, unitPrice, quantity }',
      '',
      'OCR text:',
      rawText,
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? '';
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    try {
      return JSON.parse(content) as ParsedInvoice;
    } catch {
      throw new Error('OpenAI returned invalid JSON');
    }
  }

  private validateAndNormalize(
    parsed: ParsedInvoice,
    eventCurrency?: string,
  ): ParsedInvoice {
    const warnings: string[] = [];
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => ({
            name: String(item.name ?? '').trim(),
            unitPrice: Number(item.unitPrice),
            quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
          }))
          .filter((item) => item.name && Number.isFinite(item.unitPrice))
      : [];

    const subtotal = this.normalizeNumber(parsed.subtotal);
    const tipAmount = this.normalizeNumber(parsed.tipAmount);
    const totalAmount = this.normalizeNumber(parsed.totalAmount);

    if (subtotal !== null && subtotal <= 0) warnings.push('Subtotal should be positive.');
    if (tipAmount !== null && tipAmount < 0) warnings.push('Tip should be >= 0.');
    if (totalAmount !== null && totalAmount <= 0) warnings.push('Total should be positive.');

    if (
      subtotal !== null &&
      tipAmount !== null &&
      totalAmount !== null &&
      Math.abs(subtotal + tipAmount - totalAmount) > 0.5
    ) {
      warnings.push('Subtotal + tip does not match total.');
    }

    const normalizedCurrency = parsed.currency ? String(parsed.currency).trim().toUpperCase() : null;
    const eventCurrencyValue = eventCurrency ? eventCurrency.trim().toUpperCase() : null;
    if (!normalizedCurrency && eventCurrencyValue) {
      warnings.push('Currency missing, using event currency.');
    }
    if (normalizedCurrency && eventCurrencyValue && normalizedCurrency !== eventCurrencyValue) {
      warnings.push('Currency does not match event currency. Using event currency.');
    }

    return {
      description: String(parsed.description ?? '').trim() || 'Consumo',
      subtotal,
      tipAmount,
      totalAmount,
      currency: eventCurrencyValue ?? (normalizedCurrency ? normalizedCurrency : null),
      date: parsed.date ? String(parsed.date).trim() : null,
      items,
      warnings,
      source: parsed.source ?? { ocr: 'ocr.space', model: 'gpt-4o-mini' },
    };
  }

  private normalizeNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
  }
}
