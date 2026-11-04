import { NativeDataFetcher } from '@sitecore-content-sdk/core';
import { resolveEdgeUrl } from '@sitecore-content-sdk/core/tools';
import { COMMERCE_PROXY_PATH } from './constants';
import { debug } from './debug';
import { toCommerceError } from './errors';

/**
 * Transport options shared by commerce HTTP calls.
 * @internal
 */
export interface CommerceHttpOptions {
  timeout?: number;
  fetch?: typeof fetch;
}

/**
 * Builds a commerce proxy URL: `{edgeUrl}/oc/storefront{path}`.
 * @param {string | undefined} edgeUrl Edge URL; resolved with defaults when omitted
 * @param {string} path path relative to the proxy, starting with '/'
 * @returns {string} absolute URL
 * @internal
 */
export function buildProxyUrl(edgeUrl: string | undefined, path: string): string {
  return `${resolveEdgeUrl(edgeUrl).replace(/\/+$/, '')}${COMMERCE_PROXY_PATH}${path}`;
}

/**
 * Performs a commerce HTTP request with redacted debug logging and normalized errors.
 * Caller-initiated aborts are re-thrown unchanged; everything else becomes a CommerceError.
 * A new fetcher is created per request because NativeDataFetcher tracks its timeout per instance.
 * @param {string} url request URL
 * @param {RequestInit} init request init
 * @param {CommerceHttpOptions} [options] transport options
 * @returns {Promise<T>} response data
 * @internal
 */
export async function commerceFetch<T>(
  url: string,
  init: RequestInit,
  options: CommerceHttpOptions = {}
): Promise<T> {
  const fetcher = new NativeDataFetcher({
    debugger: debug,
    timeout: options.timeout,
    fetch: options.fetch,
  });

  try {
    const response = await fetcher.fetch<T>(url, init);
    return response.data;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw toCommerceError(error);
  }
}
