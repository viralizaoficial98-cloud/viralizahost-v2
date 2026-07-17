/**
 * Converts a raw byte value (or MB value if indicated) to a human-readable
 * string with appropriate unit (B, KB, MB, GB, TB).
 *
 * @param value   Raw numeric value
 * @param unit    'bytes' (default) | 'MB' — the input unit
 */
export function formatBytes(value: number | string | null | undefined, unit: 'bytes' | 'MB' = 'bytes'): string {
  const raw = Number(value)
  if (!isFinite(raw) || raw < 0) return '0 B'
  const bytes = unit === 'MB' ? raw * 1024 * 1024 : raw
  if (bytes === 0)           return '0 B'
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 ** 2)     return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`
  if (bytes < 1024 ** 3)     return `${(bytes / 1024 ** 2).toFixed(2).replace(/\.?0+$/, '')} MB`
  if (bytes < 1024 ** 4)     return `${(bytes / 1024 ** 3).toFixed(2).replace(/\.?0+$/, '')} GB`
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`
}

/** Returns a value in 0-100 representing percentage; clamps to [0,100]. */
export function usagePct(used: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.min(Math.round((used / total) * 100), 100)
}

/** Color based on usage percentage. */
export function usageColor(pct: number): string {
  if (pct >= 95) return '#EF4444'
  if (pct >= 85) return '#F97316'
  if (pct >= 70) return '#F59E0B'
  return '#10B981'
}
