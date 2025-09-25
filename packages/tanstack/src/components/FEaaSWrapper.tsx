'use client';
import {
  FEaaSWrapper,
  FEaaSComponentParams,
  fetchFEaaSComponentServerProps,
} from '@sitecore-content-sdk/react';
import { GetComponentServerProps } from '../sharedTypes/component-props';

/**
 * TODO: remove when framework agnostic forms implemented
 * This is a repackaged version of the React FEaaSWrapper component with support for
 * server rendering in TanStack Start (using component-level data-fetching feature of Content SDK).
 */

/**
 * Will be called during server-side rendering
 * @param {ComponentRendering} rendering
 * @param {LayoutServiceData} layoutData
 * @returns {Record<string, unknown>} component props
 */
export const getComponentServerProps: GetComponentServerProps = async (rendering, layoutData) => {
  const params: FEaaSComponentParams = rendering.params || {};
  const result = await fetchFEaaSComponentServerProps(
    params,
    layoutData.sitecore.context.pageState
  );
  return result;
};

export default FEaaSWrapper;
