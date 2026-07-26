/**
 * Format a Date as local time in `yyyy-MM-dd HH:mm:ss` format.
 * Uses the system's local timezone.
 */
export function formatLocalTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
