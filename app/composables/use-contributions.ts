import type { DayContribution } from "~/composables/use-dashboard-stats";
import { useQuery } from "@tanstack/vue-query";

export function contributionsKey() {
  return ["contributions"] as const;
}

/**
 * Tier 2 read for the dashboard contribution grid.
 *
 * Returns a dense, oldest→newest array of every day in the last 365 days
 * (missing days = count 0) so the grid's column/month math stays aligned.
 */
export function useContributions(opts?: { enabled?: ComputedRef<boolean> }) {
  const requestFetch = useRequestFetch();

  return useQuery<DayContribution[], Error>({
    queryKey: contributionsKey(),
    queryFn: async () => {
      const data = await requestFetch<{ days: { date: string; count: number }[] }>(
        "/api/contributions",
      );
      const counts = new Map<string, number>();
      for (const day of data?.days ?? []) {
        counts.set(day.date, day.count);
      }

      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - 364);

      const days: DayContribution[] = [];
      const totalDays = Math.round((end.getTime() - start.getTime()) / 8.64e7) + 1;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        days.push({ date: key, count: counts.get(key) ?? 0 });
      }
      return days;
    },
    enabled: computed(() => opts?.enabled?.value ?? true),
  });
}
