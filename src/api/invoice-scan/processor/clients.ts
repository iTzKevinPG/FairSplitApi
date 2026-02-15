import type { ParsedInvoice, VisionDetail } from './types';
import { getParserRulesPrompt, getParserSystemPrompt } from './prompts';

export async function extractTextFromOcrSpace(apiKey: string, imageInput: string) {
  const body = new URLSearchParams();
  body.set('apikey', apiKey);
  body.set('language', 'spa');
  body.set('isOverlayRequired', 'false');
  body.set('OCREngine', '2');
  if (isDataUrl(imageInput)) {
    body.set('base64Image', imageInput);
  } else {
    body.set('url', imageInput);
  }

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorPayload = await readJsonOrText(response);
    throw new Error(
      `OCR request failed: status=${response.status}, details=${toCompactErrorDetails(errorPayload)}`,
    );
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

export async function parseInvoiceFromImageWithOpenAI(
  apiKey: string,
  imageUrl: string,
  detail: VisionDetail,
): Promise<ParsedInvoice> {
  const system = getParserSystemPrompt();
  const userRules = getParserRulesPrompt();

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
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract receipt/invoice fields from this image and normalize them.\n\n${userRules}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const requestId =
      response.headers.get('x-request-id') ?? response.headers.get('openai-request-id') ?? 'n/a';
    const errorPayload = await readJsonOrText(response);
    throw new Error(
      `OpenAI vision request failed: status=${response.status}, requestId=${requestId}, details=${toCompactErrorDetails(errorPayload)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('OpenAI vision returned empty response');
  }

  let parsed: ParsedInvoice;
  try {
    parsed = JSON.parse(content) as ParsedInvoice;
  } catch {
    throw new Error('OpenAI vision returned invalid JSON');
  }

  return {
    ...parsed,
    source: { ocr: `openai-vision-${detail}`, model: 'gpt-4o-mini' },
  };
}

export async function parseInvoiceFromOcrTextWithOpenAI(
  apiKey: string,
  rawText: string,
): Promise<ParsedInvoice> {
  const system = getParserSystemPrompt();
  const user = [
    'Extract receipt/invoice fields from OCR text and normalize them.',
    '',
    getParserRulesPrompt(),
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
    const requestId =
      response.headers.get('x-request-id') ?? response.headers.get('openai-request-id') ?? 'n/a';
    const errorPayload = await readJsonOrText(response);
    throw new Error(
      `OpenAI OCR-text request failed: status=${response.status}, requestId=${requestId}, details=${toCompactErrorDetails(errorPayload)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('OpenAI OCR-text returned empty response');
  }

  let parsed: ParsedInvoice;
  try {
    parsed = JSON.parse(content) as ParsedInvoice;
  } catch {
    throw new Error('OpenAI OCR-text returned invalid JSON');
  }

  return {
    ...parsed,
    source: { ocr: 'ocr.space', model: 'gpt-4o-mini' },
  };
}

export async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function toCompactErrorDetails(payload: unknown): string {
  if (payload === null || payload === undefined) return 'empty';
  if (typeof payload === 'string') return payload.slice(0, 700);
  if (typeof payload !== 'object') return String(payload);

  const obj = payload as Record<string, unknown>;
  const error = (obj.error as Record<string, unknown> | undefined) ?? undefined;
  const details = {
    message: (error?.message as string | undefined) ?? (obj.message as string | undefined),
    type: error?.type as string | undefined,
    code: error?.code as string | undefined,
    param: error?.param as string | undefined,
  };
  return JSON.stringify(details);
}

export function toOneLineErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, ' ').trim();
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:image/');
}
