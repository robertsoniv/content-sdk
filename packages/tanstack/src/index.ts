// Re-export core functionality
export {
  constants,
  NativeDataFetcher,
  enableDebug,
  debug,
  CacheClient,
  MemoryCacheClient,
} from '@sitecore-content-sdk/core';

export type {
  NativeDataFetcherConfig,
  NativeDataFetcherResponse,
  NativeDataFetcherError,
  HTMLLink,
  CacheOptions,
} from '@sitecore-content-sdk/core';

// Re-export layout functionality
export {
  LayoutServiceData,
  LayoutServicePageState,
  LayoutServiceContext,
  LayoutServiceContextData,
  LayoutService,
  PlaceholderData,
  PlaceholdersData,
  RouteData,
  Field,
  Item,
  getChildPlaceholder,
  getFieldValue,
  ComponentRendering,
  ComponentFields,
  ComponentParams,
  getContentStylesheetLink,
} from '@sitecore-content-sdk/core/layout';

export type {
  LayoutServiceConfig,
  EditMode,
  RenderingType,
} from '@sitecore-content-sdk/core/layout';

// Re-export client functionality
export { PageMode, ErrorPage, Page } from '@sitecore-content-sdk/core/client';

// Re-export editing functionality
export { ComponentLayoutService } from '@sitecore-content-sdk/core/editing';

// Export TanStack-specific editing middleware
export {
  EditingRenderMiddleware,
  EditingConfigMiddleware,
  FEAASRenderMiddleware,
} from './editing';

// Re-export media functionality
export { mediaApi } from '@sitecore-content-sdk/core/media';

// Re-export i18n functionality
export { DictionaryPhrases, DictionaryService } from '@sitecore-content-sdk/core/i18n';

export type { DictionaryServiceConfig } from '@sitecore-content-sdk/core/i18n';

// Re-export personalization functionality
export {
  personalizeLayout,
  getPersonalizedRewrite,
  getPersonalizedRewriteData,
  getGroomedVariantIds,
  normalizePersonalizedRewrite,
  CdpHelper,
  PersonalizeService,
} from '@sitecore-content-sdk/core/personalize';

export type { PersonalizeServiceConfig } from '@sitecore-content-sdk/core/personalize';

// Re-export site functionality
export {
  SitePathService,
  RedirectsService,
  REDIRECT_TYPE_301,
  REDIRECT_TYPE_302,
  REDIRECT_TYPE_SERVER_TRANSFER,
  RedirectInfo,
  SitemapXmlService,
  ErrorPagesService,
  RobotsQueryResult,
  RobotsService,
  ErrorPages,
  SiteInfo,
  SiteResolver,
  SiteInfoService,
  getSiteRewrite,
  getSiteRewriteData,
  normalizeSiteRewrite,
} from '@sitecore-content-sdk/core/site';

export type {
  SitePathServiceConfig,
  RedirectsServiceConfig,
  SitemapXmlServiceConfig,
  ErrorPagesServiceConfig,
  RobotsServiceConfig,
  SiteInfoServiceConfig,
} from '@sitecore-content-sdk/core/site';

export { StaticPath } from '@sitecore-content-sdk/core';

// Export TanStack-specific types
export type {
  ComponentPropsCollection,
  ComponentPropsError,
  TanstackContentSdkComponent,
  GetComponentServerProps,
  TanstackContext,
} from './sharedTypes/component-props';

export type { SitecorePageProps } from './sharedTypes/sitecore-page-props';

// Export TanStack-specific services
export { ComponentPropsService } from './services/component-props-service';

// Export TanStack-specific components
export { Link } from './components/Link';
export { RichText } from './components/RichText';
export { Placeholder } from './components/Placeholder';
export { TanstackImage } from './components/TanstackImage';

export type { LinkProps } from './components/Link';
export type { RichTextProps } from './components/RichText';
export type { TanstackImageProps } from './components/TanstackImage';

// Export component context
export {
  ComponentPropsReactContext,
  ComponentPropsContext,
  useComponentProps,
} from './components/ComponentPropsContext';

export type { ComponentPropsContextProps } from './components/ComponentPropsContext';

// Export wrappers
export { default as FEaaSWrapper } from './components/FEaaSWrapper';
export { default as BYOCWrapper } from './components/BYOCWrapper';

// Re-export React components from @sitecore-content-sdk/react
export {
  ComponentMap,
  Image,
  ImageField,
  ImageFieldValue,
  LinkField,
  LinkFieldValue,
  Text,
  TextField,
  DateField,
  FEaaSComponent,
  fetchFEaaSComponentServerProps,
  BYOCComponentParams,
  BYOCComponent,
  getDesignLibraryStylesheetLinks,
  File,
  FileField,
  RichTextField,
  DesignLibrary,
  DefaultEmptyFieldEditingComponentImage,
  DefaultEmptyFieldEditingComponentText,
  PlaceholderComponentProps,
  SitecoreProvider,
  SitecoreProviderState,
  SitecoreProviderReactContext,
  withSitecore,
  useSitecore,
  withEditorChromes,
  withPlaceholder,
  withDatasourceCheck,
  ImageSizeParameters,
  withFieldMetadata,
  withEmptyFieldEditingComponent,
  EditingScripts,
  Form,
  ServerPlaceholder,
  ClientEditingChromesUpdate,
} from '@sitecore-content-sdk/react';

export type {
  ImageProps,
  FEaaSComponentProps,
  FEaaSComponentParams,
  BYOCComponentProps,
  WithSitecoreOptions,
  WithSitecoreProps,
  WithSitecoreHocProps,
} from '@sitecore-content-sdk/react';

// Export middleware
export { MiddlewareBase, Middleware, defineMiddleware } from './middleware/middleware';

export type { MiddlewareBaseConfig } from './middleware/middleware';

export {
  RedirectsMiddleware,
  PersonalizeMiddleware,
  MultisiteMiddleware,
  SitemapMiddleware,
  RobotsMiddleware,
  LocaleMiddleware,
  createTanstackMiddleware,
  createSitecoreMiddleware,
} from './middleware';

export type {
  RedirectsMiddlewareConfig,
  PersonalizeMiddlewareConfig,
  MultisiteMiddlewareConfig,
  LocaleMiddlewareConfig,
  TanstackMiddlewareConfig,
} from './middleware';

// Export route handlers
export {
  createSitemapRouteHandler,
  createRobotsRouteHandler,
  createEditingConfigRouteHandler,
  createEditingRenderRouteHandlers,
} from './route-handler';

// Export monitoring
export { createHealthCheckMiddleware } from './monitoring';

// Export client
export { SitecoreTanstackClient, SitecoreClient } from './client';

export type { SitecoreTanstackClientConfig } from './client';

// Export site service
export { TanstackSiteService } from './site';

// Export utils
export { TanstackUtils } from './utils';

// Export config functionality
export { defineConfig, getTanStackFallbackConfig } from './config';
export type { SitecoreConfigInput, SitecoreConfig } from './config';

// Export CLI config functionality
export { defineCliConfig } from './config-cli';

// Export preview functionality
export * from './preview';

// Export tools functionality
export { generateMap, defaultTemplate, byocTemplate, generateSites } from './tools';