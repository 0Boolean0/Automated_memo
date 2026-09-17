/**
 * Shared formatting utilities.
 */

/** Format a number as BDT currency  e.g. ৳2,699 */
export function formatCurrency(amount: number | string, currency = 'BDT'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '—'
  if (currency === 'BDT') return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  return `${currency} ${num.toLocaleString()}`
}

/** Format an ISO date string to readable date e.g. "17 Sep 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format an ISO date string to readable datetime e.g. "17 Sep 2026, 8:45 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Compute profit margin percentage */
export function profitMargin(cost: number, sell: number): string {
  if (!cost || !sell) return '—'
  return `${(((sell - cost) / sell) * 100).toFixed(1)}%`
}
