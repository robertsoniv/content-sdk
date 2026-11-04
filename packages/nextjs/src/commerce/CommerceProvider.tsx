'use client';
import React from 'react';
import {
  CommerceProvider as ReactCommerceProvider,
  CommerceProviderProps as ReactCommerceProviderProps,
  CommerceTokenOptions,
} from '@sitecore-content-sdk/react/commerce';

/**
 * Props for the Next.js {@link CommerceProvider}.
 * @public
 */
export type CommerceProviderProps = Omit<ReactCommerceProviderProps, 'tokens'> & {
  /**
   * How tokens are obtained and stored.
   * @default \{ mode: 'route-handler', endpoint: '/api/commerce/token' \}
   */
  tokens?: CommerceTokenOptions;
};

const DEFAULT_TOKENS: CommerceTokenOptions = { mode: 'route-handler' };

/**
 * Next.js commerce provider. Defaults to route-handler mode, which keeps the refresh token in an
 * httpOnly cookie managed by `createCommerceTokenRouteHandler` (mounted at `/api/commerce/token`).
 * @param {CommerceProviderProps} props provider props
 * @returns {React.ReactElement} provider element
 * @public
 */
export const CommerceProvider = ({
  tokens = DEFAULT_TOKENS,
  ...props
}: CommerceProviderProps): React.ReactElement => (
  <ReactCommerceProvider tokens={tokens} {...props} />
);

CommerceProvider.displayName = 'CommerceProvider';
