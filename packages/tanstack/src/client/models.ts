import { LayoutServiceConfig } from '@sitecore-content-sdk/core/layout';

export type TanstackContentSdkClientConfig = LayoutServiceConfig & {
  /**
   * Site name for the application
   */
  siteName: string;
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
