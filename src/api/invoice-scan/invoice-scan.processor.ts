import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { INVOICE_SCAN_JOB, INVOICE_SCAN_QUEUE } from './invoice-scan.constants';
import { S3Service } from '../../infra/storage/s3.service';
import { InvoiceScanResultService } from './invoice-scan-result.service';

type ParsedItem = {
  name: string;
  unitPrice: number | null;
  quantity: number | null;
  lineTotal: number | null;
};

type ParsedInvoice = {
  description: string;
  subtotal: number | null;
  taxAmount: number | null;
  tipAmount: number | null;
  totalAmount: number | null;
  taxIncludedInItems: boolean | null;
  currency: string | null;
  date: string | null;
  items: ParsedItem[];
  notes: string | null;
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
        : (payload.ErrorMessage ?? 'OCR failed');
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
      'You are a precise invoice/receipt parser from noisy OCR text.',
      'Return ONLY a valid JSON object. No markdown, no explanations.',
      'Never hallucinate: if a value is not clearly present or cannot be reliably inferred, use null.',
      'Be robust to common receipt formats, abbreviations, and OCR mistakes.',
      'Numbers must be returned as numeric values (no currency symbols in numbers).',
      'Prefer explicit values over computed ones. If you compute, mention it in notes.',
    ].join(' ');

    const user = [
      'Extract receipt/invoice fields from OCR text and normalize them.',
      '',
      'Return a JSON with this shape:',
      '{',
      '  "description": string|null,',
      '  "currency": string|null,',
      '  "date": "YYYY-MM-DD"|null,',
      '  "subtotal": number|null,',
      '  "taxAmount": number|null,',
      '  "tipAmount": number|null,',
      '  "totalAmount": number|null,',
      '  "taxIncludedInItems": boolean|null,',
      '  "items": [',
      '    { "name": string|null, "quantity": number|null, "unitPrice": number|null, "lineTotal": number|null }',
      '  ],',
      '  "notes": string|null',
      '}',
      '',
      'Interpretation rules (important):',
      '1) Numbers:',
      ' - Normalize decimal separators (e.g., 1.234,56 => 1234.56; 1,234.56 => 1234.56).',
      ' - Ignore thousands separators.',
      '',
      '2) Items:',
      ' - Each item should include name, quantity, unitPrice, and lineTotal when possible.',
      ' - If quantity + lineTotal but no unitPrice: unitPrice = lineTotal / quantity only if quantity > 0.',
      ' - If unitPrice + lineTotal but no quantity: quantity = lineTotal / unitPrice only if near integer (tol 0.01) and >= 1.',
      ' - If only lineTotal exists: unitPrice=null, quantity=null, lineTotal=value.',
      " - Patterns like '3 x 2.50' or '3@2.50' indicate quantity and unitPrice.",
      " - If a line shows a quantity and a single price with no unit marker (e.g., '3 ARROZ 192000'), treat the price as lineTotal and infer unitPrice = lineTotal / quantity.",
      ' - If unitPrice*quantity does not match lineTotal, keep extracted values and mention in notes.',
      '',
      '3) Totals & taxes:',
      ' - Identify subtotal (pre-tax/pre-tip) when present.',
      ' - Identify tax/VAT/IVA/IGV as taxAmount when explicitly listed as separate line.',
      " - If text says tax included (e.g., 'IVA incluido', 'VAT incl.'), set taxIncludedInItems=true unless a separate tax line exists.",
      ' - If a separate tax line exists, set taxIncludedInItems=false.',
      ' - Tip/service charge: if explicitly listed (tip, gratuity, propina, service charge), set tipAmount.',
      ' - totalAmount must EXCLUDE tip. If receipt total includes tip, subtract tip and mention it in notes.',
      " - If the receipt shows 'total con propina' or similar, return totalAmount without tip and tipAmount separately.",
      ' - Discounts/bonuses should reduce totals; do not treat discount lines as items.',
      '',
      '4) Consistency checks (do not invent):',
      ' - If subtotal + taxAmount ~= totalAmount, keep all.',
      ' - If subtotal and taxAmount are present and totalAmount is missing, you may compute totalAmount = subtotal + taxAmount (do not add tip).',
      ' - If totalAmount is present, do not override it with computed values.',
      ' - If items sum matches subtotal closely (tol 0.02), trust that subtotal.',
      ' - If items sum matches totalAmount and no separate tax line, taxIncludedInItems likely true.',
      '',
      '5) Currency:',
      ' - Return ISO code if obvious (USD, COP, EUR) else return symbol ($).',
      '',
      '6) Date:',
      ' - Return date in YYYY-MM-DD if present; otherwise null.',
      '',
      '7) Notes:',
      " - Briefly describe uncertainty or inference (e.g., 'inferred qty from lineTotal/unitPrice').",
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

  private validateAndNormalize(parsed: ParsedInvoice, eventCurrency?: string): ParsedInvoice {
    const warnings: string[] = [];
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => ({
            name: String(item.name ?? '').trim(),
            unitPrice: this.normalizeNumber(item.unitPrice),
            quantity: this.normalizeQuantity(item.quantity),
            lineTotal: this.normalizeNumber(item.lineTotal),
          }))
          .filter(
            (item) =>
              item.name &&
              (item.unitPrice !== null || item.quantity !== null || item.lineTotal !== null),
          )
      : [];

    let subtotal = this.normalizeNumber(parsed.subtotal);
    const taxAmount = this.normalizeNumber(parsed.taxAmount);
    const tipAmount = this.normalizeNumber(parsed.tipAmount);
    let totalAmount = this.normalizeNumber(parsed.totalAmount);
    const taxIncludedInItems =
      typeof parsed.taxIncludedInItems === 'boolean' ? parsed.taxIncludedInItems : null;
    const notes = parsed.notes ? String(parsed.notes).trim() : null;

    if (subtotal !== null && subtotal <= 0) warnings.push('Subtotal should be positive.');
    if (taxAmount !== null && taxAmount < 0) warnings.push('Tax should be >= 0.');
    if (tipAmount !== null && tipAmount < 0) warnings.push('Tip should be >= 0.');
    if (totalAmount !== null && totalAmount <= 0) warnings.push('Total should be positive.');

    const itemsSum = this.computeItemsSum(items);
    if (totalAmount !== null && tipAmount !== null) {
      const withoutTip = Number((totalAmount - tipAmount).toFixed(2));
      if (withoutTip >= 0) {
        totalAmount = withoutTip;
        warnings.push('Total adjusted to exclude tip amount.');
      }
    }

    if (subtotal === null && itemsSum !== null) {
      subtotal = itemsSum;
      warnings.push('Subtotal inferred from items sum.');
    }

    if (subtotal !== null && totalAmount !== null) {
      const expected = subtotal + (taxAmount ?? 0);
      if (Math.abs(expected - totalAmount) > 0.5) {
        warnings.push('Subtotal + tax does not match total.');
      }
    }

    const normalizedCurrency = parsed.currency
      ? String(parsed.currency).trim().toUpperCase()
      : null;
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
      taxAmount,
      tipAmount,
      totalAmount,
      taxIncludedInItems,
      currency: eventCurrencyValue ?? (normalizedCurrency ? normalizedCurrency : null),
      date: parsed.date ? String(parsed.date).trim() : null,
      items,
      notes,
      warnings,
      source: parsed.source ?? { ocr: 'ocr.space', model: 'gpt-4o-mini' },
    };
  }

  private normalizeQuantity(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    const rounded = Math.round(num);
    return Math.abs(num - rounded) <= 0.01 ? rounded : Number(num.toFixed(2));
  }

  private normalizeNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
  }

  private computeItemsSum(items: ParsedItem[]) {
    let sum = 0;
    let hasValue = false;
    for (const item of items) {
      if (item.lineTotal !== null) {
        sum += item.lineTotal;
        hasValue = true;
      } else if (item.unitPrice !== null && item.quantity !== null) {
        sum += item.unitPrice * item.quantity;
        hasValue = true;
      }
    }
    return hasValue ? Number(sum.toFixed(2)) : null;
  }
}
