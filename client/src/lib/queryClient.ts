import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { logger } from "./logger";

async function throwIfResNotOk(res: Response, url: string, method: string) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    logger.api(method, url, res.status, text);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  logger.debug('API', `${method} ${url}`, data ? { body: data } : undefined);
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res, url, method);
  logger.debug('API', `${method} ${url} completed`, { status: res.status });
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      logger.debug('API', `GET ${url} returned 401, returning null`);
      return null;
    }

    await throwIfResNotOk(res, url, 'GET');
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
