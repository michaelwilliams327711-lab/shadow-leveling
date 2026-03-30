import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

function getLocalDateHeader(): Record<string, string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return { "x-local-date": `${yyyy}-${mm}-${dd}` };
}

export interface DailyOrder {
  id: string;
  characterId: number;
  name: string;
  statCategory: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  date: string;
}

export interface CreateDailyOrderRequest {
  name: string;
  statCategory?: string;
}

export interface HiddenBoxResult {
  id?: number;
  type: "gold" | "stat_boost";
  goldBonus?: number | null;
  statBoost?: number | null;
  stat?: string | null;
  claimed?: boolean;
}

export interface DailyOrdersToday {
  orders: DailyOrder[];
  pendingHiddenBox: HiddenBoxResult | null;
}

export interface CompleteDailyOrderResult {
  success: boolean;
  order: DailyOrder;
  xpAwarded: number;
  statGain: number;
  leveledUp: boolean;
  completedCount: number;
  pendingHiddenBox: HiddenBoxResult | null;
  character: {
    id: number;
    level: number;
    xp: number;
    xpToNextLevel: number;
    gold: number;
    strength: number;
    intellect: number;
    endurance: number;
    agility: number;
    discipline: number;
    streak: number;
    longestStreak: number;
    multiplier: number;
    lastCheckin: string | null;
    totalQuestsCompleted: number;
    totalQuestsFailed: number;
    failStreak: number;
    penaltyMultiplier: number;
  };
}

export const getDailyOrdersTodayQueryKey = () => ["/api/daily-orders/today"] as const;

export const getTodaysDailyOrders = async (options?: RequestInit): Promise<DailyOrdersToday> => {
  return customFetch<DailyOrdersToday>("/api/daily-orders/today", {
    ...options,
    method: "GET",
    headers: { ...getLocalDateHeader(), ...(options?.headers as Record<string, string> | undefined) },
  });
};

export const useGetTodaysDailyOrders = <TData = DailyOrdersToday, TError = unknown>(
  options?: { query?: UseQueryOptions<DailyOrdersToday, TError, TData>; request?: RequestInit }
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getDailyOrdersTodayQueryKey();
  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    getTodaysDailyOrders({ signal, ...requestOptions });

  return useQuery<DailyOrdersToday, TError, TData>({
    queryKey,
    queryFn,
    ...queryOptions,
  });
};

export const createDailyOrder = async (
  body: CreateDailyOrderRequest,
  options?: RequestInit
): Promise<DailyOrder> => {
  return customFetch<DailyOrder>("/api/daily-orders", {
    ...options,
    method: "POST",
    headers: { ...getLocalDateHeader(), ...(options?.headers as Record<string, string> | undefined) },
    body: JSON.stringify(body),
  });
};

export const useCreateDailyOrder = <TError = unknown, TContext = unknown>(
  options?: UseMutationOptions<DailyOrder, TError, CreateDailyOrderRequest, TContext>
) => {
  return useMutation<DailyOrder, TError, CreateDailyOrderRequest, TContext>({
    mutationFn: (body) => createDailyOrder(body),
    ...options,
  });
};

export const completeDailyOrder = async (
  id: string,
  options?: RequestInit
): Promise<CompleteDailyOrderResult> => {
  return customFetch<CompleteDailyOrderResult>(`/api/daily-orders/${id}/complete`, {
    ...options,
    method: "POST",
    headers: { ...getLocalDateHeader(), ...(options?.headers as Record<string, string> | undefined) },
  });
};

export const useCompleteDailyOrder = <TError = unknown, TContext = unknown>(
  options?: UseMutationOptions<CompleteDailyOrderResult, TError, string, TContext>
) => {
  return useMutation<CompleteDailyOrderResult, TError, string, TContext>({
    mutationFn: (id) => completeDailyOrder(id),
    ...options,
  });
};

export const deleteDailyOrder = async (id: string, options?: RequestInit): Promise<{ success: boolean }> => {
  return customFetch<{ success: boolean }>(`/api/daily-orders/${id}`, {
    ...options,
    method: "DELETE",
    headers: { ...getLocalDateHeader(), ...(options?.headers as Record<string, string> | undefined) },
  });
};

export const useDeleteDailyOrder = <TError = unknown, TContext = unknown>(
  options?: UseMutationOptions<{ success: boolean }, TError, string, TContext>
) => {
  return useMutation<{ success: boolean }, TError, string, TContext>({
    mutationFn: (id) => deleteDailyOrder(id),
    ...options,
  });
};

export interface ClaimHiddenBoxResult {
  success: boolean;
  character: CompleteDailyOrderResult["character"];
}

export const claimHiddenBox = async (options?: RequestInit): Promise<ClaimHiddenBoxResult> => {
  return customFetch<ClaimHiddenBoxResult>("/api/daily-orders/claim-hidden-box", {
    ...options,
    method: "POST",
    headers: { ...getLocalDateHeader(), ...(options?.headers as Record<string, string> | undefined) },
    body: JSON.stringify({}),
  });
};

export const useClaimHiddenBox = <TError = unknown, TContext = unknown>(
  options?: UseMutationOptions<ClaimHiddenBoxResult, TError, void, TContext>
) => {
  return useMutation<ClaimHiddenBoxResult, TError, void, TContext>({
    mutationFn: () => claimHiddenBox(),
    ...options,
  });
};
