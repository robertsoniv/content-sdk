// Re-export core client functionality (like Next.js does)
export {
  GraphQLClientError,
  RetryStrategy,
  DefaultRetryStrategy,
  GraphQLRequestClient,
  GraphQLRequestClientFactory,
  GraphQLRequestClientFactoryConfig,
  getEdgeProxyContentUrl,
  createGraphQLClientFactory,
  SitecoreClientInit,
} from '@sitecore-content-sdk/core/client';

// Export Tanstack-specific client
export { SitecoreTanstackClient } from './sitecore-tanstack-client';
export { SitecoreTanstackClientConfig } from './models';

// Export as SitecoreClient for consistency with Next.js package
export { SitecoreTanstackClient as SitecoreClient } from './sitecore-tanstack-client';
