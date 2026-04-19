import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { Quest } from "./generated/api.schemas";

export interface ListQuestsWindowedParams {
  windowDays?: number | null;
}

export const getListQuestsWindowedUrl = (params?: ListQuestsWindowedParams): string => {
  const windowDays = params?.windowDays;
  if (windowDays != null && windowDays > 0) {
    return `/api/quests?windowDays=${windowDays}`;
  }
  return `/api/quests`;
};

export const getListQuestsWindowedQueryKey = (
  params?: ListQuestsWindowedParams,
): readonly [string, ListQuestsWindowedParams?] => {
  if (params?.windowDays != null) {
    return [`/api/quests`, { windowDays: params.windowDays }] as const;
  }
  return [`/api/quests`] as const;
};

export const listQuestsWindowed = async (
  params?: ListQuestsWindowedParams,
  options?: RequestInit,
): Promise<Quest[]> => {
  const localDate = new Date().toLocaleDateString("en-CA");
  return customFetch<Quest[]>(getListQuestsWindowedUrl(params), {
    ...options,
    method: "GET",
    headers: {
      "x-local-date": localDate,
      ...(options as Record<string, unknown> | undefined)?.["headers"] as Record<string, string> | undefined,
    },
  });
};

export function useListQuestsWindowed<
  TData = Quest[],
  TError = unknown,
>(
  params?: ListQuestsWindowedParams,
  options?: {
    query?: UseQueryOptions<Quest[], TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getListQuestsWindowedQueryKey(params);

  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    listQuestsWindowed(params, { signal, ...requestOptions });

  const query = useQuery<Quest[], TError, TData>({
    queryKey,
    queryFn,
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey };
}
