import { CommerceTokenStore } from './token-store';
import { ShopperSession, TokenKey } from '../models';

/**
 * Creates an in-memory token store. Each call returns an isolated store; never share one across
 * server requests.
 * @returns {CommerceTokenStore} token store
 * @public
 */
export function createMemoryTokenStore(): CommerceTokenStore {
  const sessions = new Map<TokenKey, ShopperSession>();

  return {
    get: (key) => {
      const session = sessions.get(key);
      return session ? { ...session } : null;
    },
    set: (key, session) => {
      sessions.set(key, { ...session });
    },
    clear: (key) => {
      if (key === undefined) sessions.clear();
      else sessions.delete(key);
    },
  };
}
