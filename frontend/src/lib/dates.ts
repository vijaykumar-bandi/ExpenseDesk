/** Every timestamp is UTC on the wire and Asia/Kolkata on screen. */

const KOLKATA = 'Asia/Kolkata';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: KOLKATA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: KOLKATA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** "2026-11-03T04:46:50Z" -> "03 Nov 2026, 10:16" */
export function formatDateTime(utcIso: string | null | undefined): string {
  if (!utcIso) return '';
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return '';
  return dateTimeFormatter.format(date).replace(',', ',');
}

/** "2026-11-03" -> "03 Nov 2026" */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function todayInKolkata(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOLKATA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}
