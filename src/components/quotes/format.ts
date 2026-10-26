// Formatos compartidos por la vista de cotización y el comparador.

export function money(amount: number | null | undefined, currency: string | null, locale: string) {
  if (amount === null || amount === undefined) return "—";
  if (!currency) return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(amount);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 4 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function plainNumber(value: number | null | undefined, locale: string) {
  return value === null || value === undefined ? "—" : new Intl.NumberFormat(locale).format(Number(value));
}
