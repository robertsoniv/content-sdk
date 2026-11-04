import { useCallback, useEffect, useMemo } from 'react';
import { CommerceError, MeUser, ShopperUserType } from '@sitecore-content-sdk/commerce';
import { useCommerce, useCommerceInternal } from './CommerceProvider';

/**
 * Options for {@link useShopper}.
 * @public
 */
export interface UseShopperOptions {
  /**
   * Whether the hook should load the current shopper.
   * @default true
   */
  enabled?: boolean;
}

/**
 * State returned by {@link useShopper}.
 * @public
 */
export interface UseShopperState {
  /**
   * Current shopper from `GET /v1/me`, for anonymous and registered shoppers.
   */
  user: MeUser | null;
  /**
   * Shopper type, available as soon as a session exists (before `user` loads).
   */
  userType: ShopperUserType | null;
  isAnonymous: boolean;
  isRegistered: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: CommerceError | null;
  /**
   * Reloads the current shopper.
   */
  refetch(): Promise<void>;
}

/**
 * Returns the current shopper. Obtains a session if needed, then loads `GET /v1/me`.
 * The result is shared by every consumer under the same `CommerceProvider` (one request per shopper
 * identity), and reloaded only when the identity changes, never on a plain token refresh.
 * @param {UseShopperOptions} [options] hook options
 * @returns {UseShopperState} shopper state
 * @public
 */
export function useShopper(options: UseShopperOptions = {}): UseShopperState {
  const { enabled = true } = options;
  const { userType } = useCommerce();
  const { sessionVersion, shopper, loadShopper } = useCommerceInternal();

  useEffect(() => {
    if (enabled) loadShopper();
  }, [enabled, sessionVersion, loadShopper]);

  const refetch = useCallback(() => loadShopper(true), [loadShopper]);

  return useMemo(
    (): UseShopperState => ({
      user: shopper.user,
      userType,
      isAnonymous: userType === 'anonymous',
      isRegistered: userType === 'registered',
      status: shopper.status,
      isLoading: shopper.status === 'loading',
      isSuccess: shopper.status === 'success',
      isError: shopper.status === 'error',
      error: shopper.error,
      refetch,
    }),
    [shopper, userType, refetch]
  );
}
