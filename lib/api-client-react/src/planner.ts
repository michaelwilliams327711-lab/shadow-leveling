import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey, UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { Quest } from "./generated/api.schemas";

export interface PlannerDailyOrder {
  id: string;
  characterId: number;
  name: string;
  statCategory: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  date: string;
}

export interface PlannerBadHabit {
  id: string;
  name: string;
  category: string;
  severity: string;
  createdAt: string;
  isActive: number;
  todayStatus: string | null;
}

export interface DailyPlannerData {
  date: string;
  quests: Quest[];
  dailyOrders: PlannerDailyOrder[];
  badHabits: PlannerBadHabit[];
  totalXpAvailable: number;
  completedTodayCount: number;
  totalDueCount: number;
}

export interface WeeklyPlannerDay {
  date: string;
  dayName: string;
  quests: Quest[];
  completedCount: number;
}

export interface WeeklyPlannerData {
  weekStart: string;
  weekEnd: string;
  days: WeeklyPlannerDay[];
}

export interface MonthlyPlannerDayMilestone {
  name: string;
  type: string;
}

export interface MonthlyPlannerDay {
  date: string;
  completedCount: number;
  failedCount: number;
  upcomingQuests: Quest[];
  milestones: MonthlyPlannerDayMilestone[];
}

export interface MonthlyPlannerData {
  year: number;
  month: number;
  monthName: string;
  today: string;
  days: MonthlyPlannerDay[];
}

export interface YearlyKeyEvent {
  date: string;
  type: "boss_defeated" | "high_xp_day" | "streak_milestone";
  label: string;
  xp?: number;
}

export interface YearlyHeatmapDay {
  date: string;
  completedCount: number;
  failedCount: number;
  xpGained: number;
  level: number;
}

export interface YearlyPlannerData {
  year: number;
  today: string;
  heatmapDays: YearlyHeatmapDay[];
  keyEvents: YearlyKeyEvent[];
}

export const getPlannerDailyQueryKey = (): readonly [string] => [`/api/planner/daily`] as const;
export const getPlannerWeeklyQueryKey = (): readonly [string] => [`/api/planner/weekly`] as const;
export const getPlannerMonthlyQueryKey = (): readonly [string] => [`/api/planner/monthly`] as const;
export const getPlannerYearlyQueryKey = (): readonly [string] => [`/api/planner/yearly`] as const;

export function useGetPlannerDaily<TData = DailyPlannerData, TError = unknown>(
  options?: {
    query?: UseQueryOptions<DailyPlannerData, TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getPlannerDailyQueryKey();
  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    customFetch<DailyPlannerData>("/api/planner/daily", { signal, ...requestOptions });
  const query = useQuery<DailyPlannerData, TError, TData>({ queryKey, queryFn, ...queryOptions }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export function useGetPlannerWeekly<TData = WeeklyPlannerData, TError = unknown>(
  options?: {
    query?: UseQueryOptions<WeeklyPlannerData, TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getPlannerWeeklyQueryKey();
  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    customFetch<WeeklyPlannerData>("/api/planner/weekly", { signal, ...requestOptions });
  const query = useQuery<WeeklyPlannerData, TError, TData>({ queryKey, queryFn, ...queryOptions }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export function useGetPlannerMonthly<TData = MonthlyPlannerData, TError = unknown>(
  options?: {
    query?: UseQueryOptions<MonthlyPlannerData, TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getPlannerMonthlyQueryKey();
  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    customFetch<MonthlyPlannerData>("/api/planner/monthly", { signal, ...requestOptions });
  const query = useQuery<MonthlyPlannerData, TError, TData>({ queryKey, queryFn, ...queryOptions }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export function useGetPlannerYearly<TData = YearlyPlannerData, TError = unknown>(
  options?: {
    query?: UseQueryOptions<YearlyPlannerData, TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getPlannerYearlyQueryKey();
  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    customFetch<YearlyPlannerData>("/api/planner/yearly", { signal, ...requestOptions });
  const query = useQuery<YearlyPlannerData, TError, TData>({ queryKey, queryFn, ...queryOptions }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export function useRescheduleQuest<TError = unknown>(
  options?: {
    mutation?: UseMutationOptions<Quest, TError, { questId: number; newDeadline: string }>;
  },
): UseMutationResult<Quest, TError, { questId: number; newDeadline: string }> {
  const { mutation: mutationOptions } = options ?? {};
  return useMutation<Quest, TError, { questId: number; newDeadline: string }>({
    mutationFn: ({ questId, newDeadline }) =>
      customFetch<Quest>(`/api/planner/quest/${questId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDeadline }),
      }),
    ...mutationOptions,
  });
}
