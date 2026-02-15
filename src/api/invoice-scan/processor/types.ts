export type ParsedItem = {
  name: string;
  unitPrice: number | null;
  quantity: number | null;
  lineTotal: number | null;
};

export type ParsedInvoice = {
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

export type VisionDetail = 'low' | 'high';

export type ConfidenceSummary = {
  overall: number;
  level: 'low' | 'medium' | 'high';
  fields: {
    totalAmount: number;
    subtotal: number;
    taxAmount: number;
    tipAmount: number;
    currency: number;
    date: number;
  };
  items: {
    count: number;
    avg: number;
    high: number;
    medium: number;
    low: number;
  };
};

export type ScanJobPayload = {
  eventId: string;
  userId: string;
  imageKey: string;
  contentType: string;
  eventCurrency?: string;
};
