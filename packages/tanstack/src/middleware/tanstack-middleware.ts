import { defineMiddleware, Middleware } from './middleware';
import { debug } from '@sitecore-content-sdk/core';

/**
 * TanStack middleware configuration
 */
export type TanstackMiddlewareConfig = {
  /**
   * List of middleware instances to execute
   */
  middlewares: Middleware[];
  /**
   * Route matching patterns (similar to Next.js matcher)
   * If not provided, middleware will run on all requests
   */
  matcher?: string[];
  /**
   * Function to determine if middleware should be skipped
   */
  skip?: (req: Request) => boolean;
};

/**
 * TanStack middleware entry point
 * This function should be used as the main middleware handler in TanStack applications
 */
export function createTanstackMiddleware(config: TanstackMiddlewareConfig) {
  const { middlewares, matcher, skip } = config;

  return async (req: Request): Promise<Response> => {
    try {
      debug.common('tanstack middleware start: %s', req.url);

      // Check if middleware should be skipped
      if (skip && skip(req)) {
        debug.common('tanstack middleware skipped by skip function');
        return new Response(null, { status: 200 });
      }

      // Check route matching
      if (matcher && !shouldRunMiddleware(req, matcher)) {
        debug.common('tanstack middleware skipped by matcher');
        return new Response(null, { status: 200 });
      }

      // Execute middleware chain
      const middlewareChain = defineMiddleware(...middlewares);
      const response = await middlewareChain.exec(req, new Response());

      debug.common('tanstack middleware completed successfully');
      return response;

    } catch (error) {
      debug.common('tanstack middleware error: %o', error);
      
      // Return error response or pass through
      return new Response(
        JSON.stringify({
          error: 'Middleware execution failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  };
}

/**
 * Determines if middleware should run based on URL path matching
 */
function shouldRunMiddleware(req: Request, matcher: string[]): boolean {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Convert Next.js-style matcher patterns to regex
  for (const pattern of matcher) {
    if (matchesPattern(pathname, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Converts Next.js-style matcher patterns to regex matching
 * Supports patterns like:
 * - '/' (exact match)
 * - '/((?!api/|_next/|healthz).*)' (negative lookahead)
 */
function matchesPattern(pathname: string, pattern: string): boolean {
  try {
    // Handle exact matches
    if (pattern === '/') {
      return pathname === '/';
    }

    // Handle regex patterns (wrapped in parentheses)
    if (pattern.startsWith('/((') && pattern.endsWith(')')) {
      // Extract the regex pattern from Next.js format
      const regexPattern = pattern.slice(2, -1); // Remove '/((' and ')'
      const regex = new RegExp(regexPattern);
      return regex.test(pathname);
    }

    // Handle simple path patterns
    if (pattern.startsWith('/') && !pattern.includes('(')) {
      return pathname.startsWith(pattern);
    }

    // Default: treat as regex
    const regex = new RegExp(pattern);
    return regex.test(pathname);

  } catch (error) {
    debug.common('error matching pattern %s against %s: %o', pattern, pathname, error);
    return false;
  }
}

/**
 * Helper function to create a TanStack middleware with common Sitecore middlewares
 */
export function createSitecoreMiddleware(config: {
  multisite: any;
  personalize: any;
  redirects: any;
  matcher?: string[];
  skip?: (req: Request) => boolean;
}) {
  const { multisite, personalize, redirects, matcher, skip } = config;

  return createTanstackMiddleware({
    middlewares: [multisite, redirects, personalize],
    matcher: matcher || [
      '/',
      '/((?!api/|_next/|healthz|sitecore/api/|-/|favicon.ico|sc_logo.svg).*)',
    ],
    skip,
  });
}
