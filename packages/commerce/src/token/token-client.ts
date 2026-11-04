import { CommerceRequestOptions, ShopperSession } from '../models';

/**
 * Result of a token client operation.
 * @public
 */
export interface TokenClientResult {
  /**
   * The new session.
   */
  session: ShopperSession;
  /**
   * True when the token client already persisted the session (e.g. a server endpoint set cookies),
   * in which case the session manager does not write it to the token store.
   */
  persisted: boolean;
}

/**
 * Obtains shopper tokens. Separate from where tokens are stored ({@link CommerceTokenStore}).
 * @public
 */
export interface CommerceTokenClient {
  /**
   * True when the client holds refresh credentials server-side (e.g. in an httpOnly cookie) and decides
   * on the server whether a refresh is possible. The session manager then delegates refreshes to it
   * instead of requiring a refresh token in the store.
   */
  readonly serverManagedRefresh?: boolean;
  /**
   * Obtains a shopper session without a refresh token in hand. Mints a new anonymous token, unless
   * the client holds server-side credentials it can use instead (route-handler client).
   */
  getAnonymousToken(options?: CommerceRequestOptions): Promise<TokenClientResult>;
  /**
   * Refreshes a registered session. `refreshToken` is undefined when the client holds it server-side.
   */
  refresh(refreshToken: string | undefined, options?: CommerceRequestOptions): Promise<TokenClientResult>;
  /**
   * Drops any server-held tokens.
   */
  clear?(options?: CommerceRequestOptions): Promise<void>;
}
