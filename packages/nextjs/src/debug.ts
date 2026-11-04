import {
  debug as coreDebug,
  debugModule,
  debugNamespace,
} from '@sitecore-content-sdk/core';
import { debug as contentDebug } from '@sitecore-content-sdk/content';
import { debug as searchDebug } from '@sitecore-content-sdk/react/search';
import { debug as commerceDebug } from '@sitecore-content-sdk/commerce';

/**
 * Unified debug object containing all debug namespaces from referenced content-sdk packages.
 * @public
 */
const debug: Record<string, debug.Debugger> = {
  ...coreDebug,
  ...contentDebug,
  search: searchDebug,
  commerce: commerceDebug,
  revalidate: debugModule(`${debugNamespace}:revalidate`),
};

export default debug;
