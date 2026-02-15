import type { ParsedInvoice, ParsedItem } from './types';

export function validateAndNormalize(parsed: ParsedInvoice, eventCurrency?: string): ParsedInvoice {
  const warnings: string[] = [];
  let items = Array.isArray(parsed.items)
    ? parsed.items
        .map((item) => ({
          name: String(item.name ?? '').trim(),
          unitPrice: normalizeNumber(item.unitPrice),
          quantity: normalizeQuantity(item.quantity),
          lineTotal: normalizeNumber(item.lineTotal),
        }))
        .filter(
          (item) =>
            item.name &&
            (item.unitPrice !== null || item.quantity !== null || item.lineTotal !== null),
        )
    : [];

  let subtotal = normalizeNumber(parsed.subtotal);
  const taxAmount = normalizeNumber(parsed.taxAmount);
  let tipAmount = normalizeNumber(parsed.tipAmount);
  let totalAmount = normalizeNumber(parsed.totalAmount);
  const taxIncludedInItems =
    typeof parsed.taxIncludedInItems === 'boolean' ? parsed.taxIncludedInItems : null;
  const notes = parsed.notes ? String(parsed.notes).trim() : null;

  const tipFromItems = extractTipFromItems(items);
  if (tipFromItems.tipAmount !== null) {
    items = tipFromItems.items;
    if (tipAmount === null) {
      tipAmount = tipFromItems.tipAmount;
      warnings.push('Tip inferred from items.');
    }
  }

  if (subtotal !== null && subtotal <= 0) warnings.push('Subtotal should be positive.');
  if (taxAmount !== null && taxAmount < 0) warnings.push('Tax should be >= 0.');
  if (tipAmount !== null && tipAmount < 0) warnings.push('Tip should be >= 0.');
  if (totalAmount !== null && totalAmount <= 0) warnings.push('Total should be positive.');

  const itemsSum = computeItemsSum(items);

  if (tipAmount === null && totalAmount !== null) {
    const base = subtotal ?? itemsSum;
    if (base !== null) {
      const inferred = Number((totalAmount - base - (taxAmount ?? 0)).toFixed(2));
      if (inferred > 0.01) {
        tipAmount = inferred;
        warnings.push('Tip inferred from total minus subtotal.');
      }
    }
  }

  if (totalAmount !== null && tipAmount !== null) {
    const baseWithTax = subtotal !== null ? Number((subtotal + (taxAmount ?? 0)).toFixed(2)) : null;
    const diffBase = baseWithTax !== null ? Math.abs(baseWithTax - totalAmount) : null;
    const diffBasePlusTip =
      baseWithTax !== null ? Math.abs(baseWithTax + tipAmount - totalAmount) : null;

    if (
      baseWithTax !== null &&
      diffBasePlusTip !== null &&
      diffBase !== null &&
      diffBasePlusTip <= 1 &&
      diffBase > 1
    ) {
      const withoutTip = Number((totalAmount - tipAmount).toFixed(2));
      if (withoutTip >= 0) {
        totalAmount = withoutTip;
        warnings.push('Total adjusted to exclude tip amount.');
      }
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
    taxAmount,
    tipAmount,
    totalAmount,
    taxIncludedInItems,
    currency: eventCurrencyValue ?? (normalizedCurrency ? normalizedCurrency : null),
    date: parsed.date ? String(parsed.date).trim() : null,
    items,
    notes,
    warnings,
    source: parsed.source ?? { ocr: 'unknown', model: 'gpt-4o-mini' },
  };
}

function normalizeQuantity(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const rounded = Math.round(num);
  return Math.abs(num - rounded) <= 0.01 ? rounded : Number(num.toFixed(2));
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

function extractTipFromItems(items: ParsedItem[]) {
  let tipAmount: number | null = null;
  const remaining: ParsedItem[] = [];
  for (const item of items) {
    if (isTipLikeItem(item.name)) {
      const value =
        item.lineTotal ??
        (item.unitPrice !== null && item.quantity !== null ? item.unitPrice * item.quantity : null);
      if (value !== null) {
        tipAmount = Number((tipAmount ?? 0) + value);
        continue;
      }
    }
    remaining.push(item);
  }
  return {
    items: remaining,
    tipAmount: tipAmount !== null ? Number(tipAmount.toFixed(2)) : null,
  };
}

function isTipLikeItem(name: string) {
  const value = name.toLowerCase();
  return (
    value.includes('propina') ||
    value.includes('tip') ||
    value.includes('gratuity') ||
    value.includes('service charge') ||
    value.includes('servicio')
  );
}

function computeItemsSum(items: ParsedItem[]) {
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
