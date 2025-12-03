export const SUPPORTED_CURRENCIES = ['COP', 'USD', 'EUR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
