// Time helpers for the store (Kuwait time). Pure: safe for server, browser and tests.
import { MONTHS } from './shop/labels';

export const STORE_TIME_ZONE = 'Asia/Kuwait';

function kuwaitParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Current (or given) month in Kuwait, 1-12 — drives the "in season now" picks. */
export function kuwaitMonth(date: Date = new Date()): number {
  return kuwaitParts(date).month;
}

/** "5 نوفمبر 2026" in Kuwait time (Latin digits, like the rest of the store). */
export function arabicDate(date: Date | string | number): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const { year, month, day } = kuwaitParts(d);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Short relative label for a real review/order time: 'الحين' (< 1 min, or a clock-skewed future time),
 * 'قبل N دقيقة', 'قبل N ساعة', 'قبل N يوم' (< 30 days), otherwise the Kuwait date ("5 نوفمبر 2026").
 */
export function relativeArabic(date: Date | string | number, now: Date | number = Date.now()): string {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return '';
  const diff = new Date(now).getTime() - t;
  if (diff < MINUTE) return 'الحين';
  if (diff < HOUR) return `قبل ${Math.floor(diff / MINUTE)} دقيقة`;
  if (diff < DAY) return `قبل ${Math.floor(diff / HOUR)} ساعة`;
  if (diff < 30 * DAY) return `قبل ${Math.floor(diff / DAY)} يوم`;
  return arabicDate(t);
}
