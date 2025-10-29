import { SitecoreClientInit } from '@sitecore-content-sdk/core/client';

/**
 * TanStack-specific client initialization options
 * Extends the core SitecoreClientInit with TanStack-specific options
 */
export type SitecoreTanstackClientConfig = SitecoreClientInit & {
  /**
   * Base URL for the application
   */
  baseUrl?: string;
  /**
   * Whether to enable client-side routing
   * @default true
   */
  enableClientRouting?: boolean;
  /**
   * Whether to enable prefetching
   * @default true
   */
  enablePrefetching?: boolean;
};

// Re-export SitecoreClientInit for convenience
export type { SitecoreClientInit };
