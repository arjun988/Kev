/**
 * Minimal fetch typing so we don't depend on DOM lib / global `fetch` names.
 * Compatible with Node 18+ global fetch and undici.
 */

/** Subset of AbortSignal used for request cancellation. */
export type AbortSignalLike = {
  readonly aborted: boolean;
  addEventListener?(type: "abort", listener: () => void): void;
  removeEventListener?(type: "abort", listener: () => void): void;
};

export type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignalLike;
};

export type FetchResult = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type FetchFn = (url: string, init?: FetchInit) => Promise<FetchResult>;

/** Resolve the runtime global fetch, or throw a clear error. */
export function resolveFetch(fetchImpl?: FetchFn): FetchFn {
  if (fetchImpl) return fetchImpl;
  const g = globalThis as typeof globalThis & { fetch?: FetchFn };
  if (typeof g.fetch === "function") return g.fetch.bind(g);
  throw new Error(
    "global fetch is not available in this runtime; pass fetchImpl in the backend config",
  );
}

/** AbortController from the runtime (Node 18+ / browsers). */
export function createAbortController(): {
  signal: AbortSignalLike;
  abort: () => void;
} {
  const g = globalThis as typeof globalThis & {
    AbortController?: new () => {
      signal: AbortSignalLike;
      abort: () => void;
    };
  };
  if (typeof g.AbortController !== "function") {
    throw new Error("AbortController is not available in this runtime");
  }
  return new g.AbortController();
}
