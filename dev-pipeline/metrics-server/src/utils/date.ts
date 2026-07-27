const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function parseStateDate(value: string): Date {
  const match = LOCAL_DATE.exec(value);
  if (!match) throw new Error(`Invalid pipeline timestamp: ${value}`);
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  );
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid pipeline timestamp: ${value}`);
  return date;
}

export function durationSeconds(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.floor((parseStateDate(end).getTime() - parseStateDate(start).getTime()) / 1000));
}
