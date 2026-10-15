// Dates are shown in Lagos time (WAT) on the server and in the browser
// alike, so the server's HTML and the browser's render agree. On Day 17 a
// signed-in user could store their own time zone.

const TIME_ZONE = 'Africa/Lagos'

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
const full = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' })
const long = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' })

/** "14:05" today, "3 Oct" this year, "3 Oct 2025" before that. */
export function shortDate(date: Date, now: Date = new Date()): string {
  const [day, today] = [dayKey.format(date), dayKey.format(now)]
  if (day === today) return time.format(date)
  if (day.slice(0, 4) === today.slice(0, 4)) return dayMonth.format(date)
  return full.format(date)
}

/** "15 Oct 2026, 14:05": for titles and the editor's footer. */
export function longDate(date: Date): string {
  return long.format(date)
}

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g)
  return words ? words.length : 0
}
