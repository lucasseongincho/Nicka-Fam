/**
 * Always exactly 2 decimals ("$12.34", never "$12.3" or "$12"). Needed
 * because amounts derived from division (a round split N ways, cents
 * converted back to dollars) can carry float noise like
 * 12.340000000000002 -- toFixed rounds that to the nearest cent for
 * display regardless.
 */
export function formatMoney(amountDollars: number): string {
  return `$${amountDollars.toFixed(2)}`;
}
