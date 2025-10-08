import {
  DeepRequired,
  defineConfig as defineConfigCore,
  SitecoreConfigInput as SitecoreConfigInputCore,
} from '@sitecore-content-sdk/core/config';

/**
 * Provides default TanStack/Vite initial values from env variables for SitecoreConfig
 * @param {SitecoreConfigInput} config optional override values to be written over default config settings
 * @returns default tanstack input config
 */
export const getTanStackFallbackConfig = (config?: SitecoreConfigInput): SitecoreConfigInput => {
  return {
    ...config,
    api: {
      ...config?.api,
      edge: {
        ...config?.api?.edge,
        contextId: config?.api?.edge?.contextId || '',
        clientContextId:
          config?.api?.edge?.clientContextId || process.env.VITE_SITECORE_EDGE_CONTEXT_ID,
        edgeUrl: config?.api?.edge?.edgeUrl || process.env.VITE_SITECORE_EDGE_URL,
      },
      local: {
        ...config?.api?.local,
        apiKey: config?.api?.local?.apiKey || process.env.VITE_SITECORE_API_KEY || '',
        apiHost: config?.api?.local?.apiHost || process.env.VITE_SITECORE_API_HOST || '',
      },
    },
    defaultSite: config?.defaultSite || process.env.VITE_DEFAULT_SITE_NAME || '',
    defaultLanguage: config?.defaultLanguage || process.env.VITE_DEFAULT_LANGUAGE || 'en',
    multisite: {
      ...config?.multisite,
      useCookieResolution:
        config?.multisite?.useCookieResolution ?? (() => process.env.VITE_ENV === 'preview'),
    },
    personalize: {
      ...config?.personalize,
      scope: config?.personalize?.scope || process.env.VITE_PERSONALIZE_SCOPE,
    },
    // TanStack-specific config options
    generateStaticPaths:
      process.env.VITE_GENERATE_STATIC_PATHS !== undefined
        ? process.env.VITE_GENERATE_STATIC_PATHS.toLowerCase() === 'true'
        : config?.generateStaticPaths ?? true,
    sitecoreInternalEditingHostUrl:
      config?.sitecoreInternalEditingHostUrl || process.env.VITE_SITECORE_INTERNAL_EDITING_HOST_URL,
  };
};

/**
 * Type to be used as config input in sitecore.config
 */
export type SitecoreConfigInput = SitecoreConfigInputCore & {
  /**
   * Indicates whether SSG `getStaticPaths` pre-render any pages.
   *
   * Set the environment variable `VITE_GENERATE_STATIC_PATHS=true`
   * to enable static paths generation.
   *
   * By default, this is set to `true`.
   *
   * This is set to `false` when the application is deployed and used as editing host in Sitecore.
   */
  generateStaticPaths?: boolean;

  /**
   * The internal host URL for the TanStack application, used for server-side requests for page rendering during editing.
   * This should be the base URL where the TanStack app is accessible from the server side (e.g., "http://localhost:3000").
   */
  sitecoreInternalEditingHostUrl?: string;
};

/**
 * Final sitecore config type used at runtime Every property should be populated, either from sitecore.config or built-in fallback values
 */
export type SitecoreConfig = DeepRequired<SitecoreConfigInput>;

/**
 * Accepts a SitecoreConfigInput object and returns full sitecore configuration
 * @param {SitecoreConfigInput} config override values to be written over default config settings
 * @returns {SitecoreConfig} full sitecore configuration to use in application
 */
export const defineConfig = (config?: SitecoreConfigInput): SitecoreConfig => {
  return defineConfigCore(getTanStackFallbackConfig(config)) as SitecoreConfig;
};
