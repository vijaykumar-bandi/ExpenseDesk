/** Money is integer paise everywhere; only the display is in rupees. */

const formatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 200075 -> "₹2,000.75" */
export function formatInr(paise: number | null | undefined): string {
  const value = Number(paise ?? 0) / 100;
  return '₹' + formatter.format(value);
}

/** "2,000.75" or "₹2,000.75" -> 200075 paise. Returns NaN for text that is not a number. */
export function parseInr(text: string): number {
  const cleaned = String(text).replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) {
    return Number.NaN;
  }
  return Math.round(Number(cleaned) * 100);
}
