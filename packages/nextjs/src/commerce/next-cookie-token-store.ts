import type { NextRequest, NextResponse } from 'next/server';
import { CommerceCookieOptions, CommerceTokenStore } from '@sitecore-content-sdk/commerce';
import {
  CookieAdapter,
  CookieAttributes,
  createCookieTokenStore,
} from '@sitecore-content-sdk/commerce/internal';

type PendingCookie = { value: string; attributes: CookieAttributes };

/**
 * Cookie adapter over a Next.js request that buffers writes so they can be applied to whichever
 * response is eventually returned. Reads see buffered writes first.
 * @internal
 */
export interface NextCookieAdapter {
  adapter: CookieAdapter;
  /**
   * Applies buffered cookie writes and deletions to a response.
   */
  applyTo(response: NextResponse): void;
}

/**
 * Creates a {@link NextCookieAdapter} for a request.
 * @param {NextRequest} request incoming request
 * @returns {NextCookieAdapter} cookie adapter
 * @internal
 */
export function createNextCookieAdapter(request: NextRequest): NextCookieAdapter {
  const pending = new Map<string, PendingCookie>();

  return {
    adapter: {
      get(name) {
        const written = pending.get(name);
        if (written) return written.attributes.maxAge > 0 ? written.value : null;
        return request.cookies.get(name)?.value ?? null;
      },
      set(name, value, attributes) {
        pending.set(name, { value, attributes });
      },
      delete(name, attributes) {
        pending.set(name, { value: '', attributes: { ...attributes, httpOnly: false, maxAge: 0 } });
      },
    },
    applyTo(response) {
      pending.forEach(({ value, attributes }, name) => {
        response.cookies.set(name, value, {
          path: attributes.path,
          sameSite: attributes.sameSite,
          secure: attributes.secure,
          httpOnly: attributes.httpOnly,
          maxAge: attributes.maxAge,
          ...(attributes.domain ? { domain: attributes.domain } : {}),
        });
      });
    },
  };
}

/**
 * Creates a server-side commerce token store over Next.js request/response cookies. The refresh token
 * is stored in an httpOnly cookie; the access-token session cookie stays readable by the browser.
 * @param {NextCookieAdapter} cookies cookie adapter for the current request
 * @param {CommerceCookieOptions} [options] cookie options
 * @returns {CommerceTokenStore} token store
 * @internal
 */
export function createNextCookieTokenStore(
  cookies: NextCookieAdapter,
  options?: CommerceCookieOptions
): CommerceTokenStore {
  return createCookieTokenStore(cookies.adapter, {
    refreshTokenStorage: 'http-only',
    cookies: options,
  });
}
