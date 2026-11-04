import { debugNamespace, debugModule, Debugger } from '@sitecore-content-sdk/core';

/**
 * Debugger for the commerce package. Never logs token values.
 * @public
 */
export const debug: Debugger = debugModule(`${debugNamespace}:commerce`);
