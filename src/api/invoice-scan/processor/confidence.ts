import type { ConfidenceSummary, ParsedInvoice } from './types';

export function buildConfidenceSummary(parsed: ParsedInvoice): ConfidenceSummary {
  const fieldScore = {
    totalAmount: parsed.totalAmount !== null ? 1 : 0,
    subtotal: parsed.subtotal !== null ? 0.9 : 0,
    taxAmount: parsed.taxAmount !== null ? 0.7 : 0.4,
    tipAmount: parsed.tipAmount !== null ? 0.7 : 0.4,
    currency: parsed.currency ? 0.8 : 0.2,
    date: parsed.date ? 0.8 : 0.2,
  };

  const itemScores = (parsed.items ?? []).map((item) => {
    let score = 0;
    if (item.name && item.name.trim().length > 1) score += 0.4;
    const numericCount =
      (item.lineTotal !== null ? 1 : 0) +
      (item.unitPrice !== null ? 1 : 0) +
      (item.quantity !== null ? 1 : 0);
    if (numericCount >= 2) score += 0.6;
    else if (numericCount === 1) score += 0.35;
    return Math.min(1, Number(score.toFixed(2)));
  });

  const rawItemsAvg =
    itemScores.length > 0
      ? Number(
          (itemScores.reduce((acc, current) => acc + current, 0) / itemScores.length).toFixed(2),
        )
      : 0;

  const itemsSum = computeItemsSum(parsed.items ?? []);
  const referenceAmount = parsed.subtotal ?? parsed.totalAmount;
  let consistencyPenaltyFactor = 1;
  if (itemsSum !== null && referenceAmount !== null && referenceAmount > 0) {
    const diffRatio = Math.abs(itemsSum - referenceAmount) / referenceAmount;
    if (diffRatio > 0.4) {
      consistencyPenaltyFactor = 0.35;
    } else if (diffRatio > 0.2) {
      consistencyPenaltyFactor = 0.6;
    } else if (diffRatio > 0.08) {
      consistencyPenaltyFactor = 0.8;
    }
  }
  const itemsAvg = Number((rawItemsAvg * consistencyPenaltyFactor).toFixed(2));

  const fieldAvg = Number(
    (
      (fieldScore.totalAmount +
        fieldScore.subtotal +
        fieldScore.taxAmount +
        fieldScore.tipAmount +
        fieldScore.currency +
        fieldScore.date) /
      6
    ).toFixed(2),
  );

  const overall = Number((fieldAvg * 0.65 + itemsAvg * 0.35).toFixed(2));
  const level = overall >= 0.78 ? 'high' : overall >= 0.58 ? 'medium' : 'low';

  return {
    overall,
    level,
    fields: fieldScore,
    items: {
      count: itemScores.length,
      avg: itemsAvg,
      high: itemScores.filter((score) => score >= 0.75).length,
      medium: itemScores.filter((score) => score >= 0.5 && score < 0.75).length,
      low: itemScores.filter((score) => score < 0.5).length,
    },
  };
}

export function isLowConfidence(parsed: ParsedInvoice, confidence: ConfidenceSummary): boolean {
  const warningsCount = parsed.warnings?.length ?? 0;
  const itemsCount = parsed.items?.length ?? 0;
  const missingMainAmounts = parsed.totalAmount === null && parsed.subtotal === null;
  const missingCurrency = parsed.currency === null;

  if (missingMainAmounts) return true;
  if (warningsCount >= 4) return true;
  if (itemsCount === 0 && parsed.totalAmount === null) return true;
  if (itemsCount === 0 && missingCurrency) return true;
  if (confidence.overall < 0.58) return true;

  return false;
}

export function isHighConfidenceForLowPass(
  confidence: ConfidenceSummary,
  parsed: ParsedInvoice,
): boolean {
  if (confidence.overall >= 0.8) return true;
  const hasManyItems = (parsed.items?.length ?? 0) >= 6;
  if (hasManyItems && confidence.overall >= 0.75) return true;
  return false;
}

function computeItemsSum(items: ParsedInvoice['items']) {
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
