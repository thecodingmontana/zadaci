import {
	differenceInCalendarDays,
	differenceInHours,
	differenceInMinutes,
	format,
	isToday,
	isYesterday,
	parseISO,
} from "date-fns";

/** "just now", "5m ago", "3h ago", "2d ago", then "Mar 4", like the reference feed. */
export function ago(iso: string | Date, now = new Date()) {
	const date = new Date(iso);
	const m = differenceInMinutes(now, date);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m ago`;
	const h = differenceInHours(now, date);
	if (h < 24) return `${h}h ago`;
	const d = differenceInCalendarDays(now, date);
	if (d < 7) return `${d}d ago`;
	return format(date, "MMM d");
}

/** Day group heading for feeds: Today, Yesterday, This week, Earlier. */
export function dayBucket(iso: string) {
	const date = new Date(iso);
	if (isToday(date)) return "Today";
	if (isYesterday(date)) return "Yesterday";
	if (differenceInCalendarDays(new Date(), date) < 7) return "This week";
	return "Earlier";
}

/** Groups newest-first items under their day heading, keeping order. */
export function byDay<T extends { createdAt: string }>(items: T[]) {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const key = dayBucket(item.createdAt);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return [...groups];
}

/** "Oct 31" (or "Oct 31, 2026" when `long`) from a "YYYY-MM-DD" day. */
export function fmtDay(day: string | null | undefined, long = false) {
	if (!day) return "—";
	return format(parseISO(day), long ? "MMM d, yyyy" : "MMM d");
}

/** Whole days from today until a "YYYY-MM-DD" day (negative when it has passed). */
export const daysUntil = (day: string) =>
	differenceInCalendarDays(parseISO(day), new Date());

/** "Today", "Tomorrow", "Yesterday", a weekday this week, else "Oct 31" (reference relDate). */
export function relDay(day: string | null | undefined) {
	if (!day) return "";
	const n = daysUntil(day);
	if (n === 0) return "Today";
	if (n === 1) return "Tomorrow";
	if (n === -1) return "Yesterday";
	if (n > 1 && n < 7) return format(parseISO(day), "EEE");
	return fmtDay(day);
}
