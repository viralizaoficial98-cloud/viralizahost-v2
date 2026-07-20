/** AOA (Kwanza) to other currencies conversion rates */
export const AOA_RATES: Record<string, number> = {
  AKZ: 1,
  BRL: 0.0042,
  USD: 0.00109,
}

/**
 * Convert a price stored in AOA to the target currency.
 * All prices in the DB and fallback plans are stored as AOA integers.
 */
export function convertFromAOA(aoa: number, currency: string): number {
  return aoa * (AOA_RATES[currency] ?? 1)
}
