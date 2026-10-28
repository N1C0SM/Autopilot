/** Decimal en español con coma: 7,4 */
export function formatDecimal(value: number | string | null | undefined, digits = 1): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
