// Re-export core editing functionality
export { ComponentLayoutService, EditingService } from '@sitecore-content-sdk/core/editing';

// Export TanStack-specific editing middlewares
export {
  EditingRenderMiddleware,
  type EditingRenderMiddlewareConfig,
} from './editing-render-middleware';

export {
  EditingConfigMiddleware,
  type EditingConfigMiddlewareConfig,
} from './editing-config-middleware';

export {
  FEAASRenderMiddleware,
  type FEAASRenderMiddlewareConfig,
} from './feaas-render-middleware';

// Export base render middleware
export { RenderMiddlewareBase } from './render-middleware';

// Export editing utilities
export {
  getEditingSecretFromRequest,
  getEditingSecretFromEnv,
  validateEditingSecret,
  getAllowedOrigins,
  validateOrigin,
  getQueryParamsForPropagation,
  getHeadersForPropagation,
  getCookiesForPropagation,
  cleanupNextPreviewCookies,
  getPreviewCookies,
  getRequiredEditingParamsList,
  mapEditingParams,
  getEditingRequestHtml,
  getCSPHeader,
  resolveServerUrl,
  isDesignLibraryPreviewData,
  getDesignLibraryPreviewData,
} from './utils';

// Export editing constants
export {
  EDITING_PASS_THROUGH_HEADERS,
  QUERY_PARAM_VERCEL_PROTECTION_BYPASS,
  QUERY_PARAM_VERCEL_SET_BYPASS_COOKIE,
  DEFAULT_EDITING_SECRET_ENV,
  DEFAULT_EDITING_ALLOWED_ORIGINS_ENV,
  DEFAULT_EDITING_RENDER_PATH,
  DEFAULT_EDITING_CONFIG_PATH,
  DEFAULT_FEAAS_RENDER_PATH,
  EDITING_CSP_HEADER,
  DEFAULT_EDITING_TIMEOUT,
  DEFAULT_EDITING_CACHE_CONTROL,
} from './constants';

// Re-export layout constants
export {
  RenderingType,
  EDITING_COMPONENT_PLACEHOLDER,
  EDITING_COMPONENT_ID,
} from '@sitecore-content-sdk/core/layout';
