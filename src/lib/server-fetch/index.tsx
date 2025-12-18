/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'edge';

import type { NextRequest } from 'next/server';

type MakeServerFetchOpts = {
  req: NextRequest;
  baseURL?: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  cookieHeader?: string;
  requestId?: string;
  logger?: (msg: string, meta?: any) => void;
};

const CLEANUP = Symbol('cleanup');

function joinUrl(base: string, path: string) {
  if (!base) return path || '/';
  if (!path) return base;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function makeTimeoutSignal(timeoutMs?: number): { signal?: AbortSignal; cancel?: () => void } {
  if (!timeoutMs || timeoutMs <= 0) return {};
  const anyAbort = AbortSignal as any;
  if (typeof anyAbort?.timeout === 'function') {
    return { signal: anyAbort.timeout(timeoutMs), cancel: () => {} };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

function bridgeSignals(req: NextRequest, timeoutMs?: number) {
  const ctrl = new AbortController();
  const onReqAbort = () => ctrl.abort();
  req.signal.addEventListener('abort', onReqAbort);

  const { signal: timeoutSignal, cancel } = makeTimeoutSignal(timeoutMs);
  const onTimeoutAbort = () => ctrl.abort();
  timeoutSignal?.addEventListener?.('abort', onTimeoutAbort as EventListener);

  const cleanup = () => {
    try {
      req.signal.removeEventListener('abort', onReqAbort);
      timeoutSignal?.removeEventListener?.('abort', onTimeoutAbort as EventListener);
      cancel?.();
    } catch {}
  };

  return { signal: ctrl.signal as AbortSignal, [CLEANUP]: cleanup } as any;
}

export function createServerFetchEdge({
  req,
  baseURL = process.env.NEXT_PUBLIC_CMS_URL || 'https://dev-cms.vivreal.io',
  timeoutMs = 15000,
  defaultHeaders,
  cookieHeader,
  requestId,
  logger,
}: MakeServerFetchOpts) {
  return async function serverFetch(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const url = joinUrl(baseURL, path);

    const bridged = bridgeSignals(req, timeoutMs);

    const headers = new Headers(init.headers || {});
    if (defaultHeaders) for (const [k, v] of Object.entries(defaultHeaders)) headers.set(k, v);
    if (cookieHeader && !headers.has('Cookie')) headers.set('Cookie', cookieHeader);
    if (requestId && !headers.has('x-request-id')) headers.set('x-request-id', requestId);
    if (!headers.has('X-App-Source')) headers.set('X-App-Source', 'vivreal');

    const finalInit: RequestInit = {
      ...init,
      headers,
      signal: init.signal ?? (bridged as any).signal,
      cache: 'no-store',
    };

    logger?.('edgeFetch → request', {
      method: finalInit.method || 'GET',
      url,
      timeoutMs,
    });

    try {
      const res = await fetch(url, finalInit);

      (bridged as any)[CLEANUP]?.();

      logger?.('edgeFetch ← response', {
        status: res.status,
        url,
        contentType: res.headers.get('content-type'),
      });

      return res;
    } catch (err: any) {
      (bridged as any)[CLEANUP]?.();
      logger?.('edgeFetch ✖ error', { message: err?.message, name: err?.name });
      throw err;
    }
  };
}