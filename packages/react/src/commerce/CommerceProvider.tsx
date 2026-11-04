'use client';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  CommerceCookieOptions,
  CommerceError,
  CommerceTokenClient,
  CommerceTokenStore,
  EdgeTokenClient,
  MeUser,
  OrderCloudService,
  RouteHandlerTokenClient,
  SessionChangeEvent,
  ShopperSession,
  ShopperSessionManager,
  ShopperUserType,
  createBrowserCookieTokenStore,
  createMemoryTokenStore,
  isSessionUsable,
  DEFAULT_TOKEN_KEY,
} from '@sitecore-content-sdk/commerce';
import { useSitecore } from '../components/SitecoreProvider';

/**
 * How the provider obtains and stores shopper tokens.
 * - `route-handler`: a same-origin endpoint keeps the refresh token in an httpOnly cookie (recommended)
 * - `browser`: tokens are obtained directly from Edge; the refresh token is kept in memory or, if
 *   explicitly opted in, in a JS-readable cookie
 * @public
 */
export type CommerceTokenOptions =
  | {
      mode: 'route-handler';
      /**
       * Token endpoint.
       * @default '/api/commerce/token'
       */
      endpoint?: string;
      cookies?: CommerceCookieOptions;
    }
  | {
      mode: 'browser';
      refreshTokenStorage: 'memory' | 'cookie';
      cookies?: CommerceCookieOptions;
    };

/**
 * Props for {@link CommerceProvider}.
 * @public
 */
export interface CommerceProviderProps {
  children?: React.ReactNode;
  /**
   * How tokens are obtained and stored. Ignored in editing, preview and Design Library modes,
   * where tokens are kept in memory only.
   */
  tokens: CommerceTokenOptions;
  /**
   * Acquire a session on mount instead of on first use.
   * @default false
   */
  eager?: boolean;
}

/**
 * Status of the commerce provider session.
 * @public
 */
export type CommerceStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Value returned by {@link useCommerce}.
 * @public
 */
export interface CommerceContextValue {
  /**
   * OrderCloud service bound to the provider's session. Null when the provider is misconfigured.
   */
  service: OrderCloudService | null;
  /**
   * Last known session. Null before a session has been obtained. May be stale.
   */
  session: ShopperSession | null;
  /**
   * Type of the current shopper, available as soon as a session exists.
   */
  userType: ShopperUserType | null;
  /**
   * Whether the current shopper is anonymous.
   */
  isAnonymous: boolean;
  /**
   * Status of the provider session.
   */
  status: CommerceStatus;
  /**
   * Last session error, or configuration error.
   */
  error: CommerceError | null;
  /**
   * True in editing, preview and Design Library modes.
   */
  isEditing: boolean;
  /**
   * Most recent identity change (`acquired`, `replaced` or `cleared`) observed by this provider, or
   * null. Not updated on `refreshed`. Use `reason === 'replaced'` and `previousUserType` to tell the
   * shopper that their session or cart expired.
   */
  lastSessionChange: SessionChangeEvent | null;
  /**
   * Returns a usable session, acquiring one if needed.
   */
  ensureSession(): Promise<ShopperSession>;
  /**
   * Drops the current session and starts a new anonymous one.
   */
  resetSession(): Promise<ShopperSession>;
}

/**
 * State of the shared current-shopper request.
 * @internal
 */
export interface ShopperState {
  user: MeUser | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: CommerceError | null;
}

/**
 * Internal provider context shared by commerce hooks.
 * @internal
 */
export interface CommerceInternalContextValue {
  sessionVersion: number;
  shopper: ShopperState;
  loadShopper(force?: boolean): Promise<void>;
}

const CommerceContext = React.createContext<CommerceContextValue | undefined>(undefined);
const CommerceInternalContext = React.createContext<CommerceInternalContextValue | undefined>(
  undefined
);

const IDLE_SHOPPER: ShopperState = { user: null, status: 'idle', error: null };

const toError = (error: unknown): CommerceError =>
  error instanceof CommerceError
    ? error
    : new CommerceError((error as Error)?.message || 'Commerce request failed.', {
        source: 'sdk',
      });

const isAborted = (error: unknown) => (error as Error | undefined)?.name === 'AbortError';

interface CommerceSetup {
  service: OrderCloudService;
  tokenStore: CommerceTokenStore;
}

const createSetup = (
  contextId: string,
  edgeUrl: string | undefined,
  tokens: CommerceTokenOptions,
  isEditing: boolean
): CommerceSetup => {
  let tokenStore: CommerceTokenStore;
  let tokenClient: CommerceTokenClient;

  if (isEditing) {
    // avoid third-party cookie issues in the Pages iframe and never touch the visitor's cookies
    tokenStore = createMemoryTokenStore();
    tokenClient = new EdgeTokenClient({ contextId, edgeUrl });
  } else if (tokens.mode === 'route-handler') {
    tokenStore = createBrowserCookieTokenStore({
      refreshTokenStorage: 'none',
      cookies: tokens.cookies,
    });
    tokenClient = new RouteHandlerTokenClient({ endpoint: tokens.endpoint });
  } else {
    tokenStore = createBrowserCookieTokenStore({
      refreshTokenStorage: tokens.refreshTokenStorage,
      cookies: tokens.cookies,
    });
    tokenClient = new EdgeTokenClient({ contextId, edgeUrl });
  }

  const sessionManager = new ShopperSessionManager({ tokenClient, tokenStore });
  return {
    service: new OrderCloudService({ contextId, edgeUrl, sessionManager }),
    tokenStore,
  };
};

/**
 * Provides commerce (OrderCloud) session state to commerce hooks.
 * Reads the context ID, Edge URL and page mode from `SitecoreProvider`.
 * Lazy by default: no request is made until a hook needs a session.
 * @param {CommerceProviderProps} props provider props
 * @returns {React.ReactElement} provider element
 * @public
 */
export const CommerceProvider = (props: CommerceProviderProps): React.ReactElement => {
  const { children, tokens, eager = false } = props;
  const { api, page } = useSitecore();
  const contextId = api?.edge?.clientContextId;
  const edgeUrl = api?.edge?.edgeUrl;
  const isEditing = !!(
    page?.mode?.isEditing ||
    page?.mode?.isPreview ||
    page?.mode?.isDesignLibrary
  );
  // inline `tokens` objects change identity every render; key on their content instead
  const tokensKey = JSON.stringify(tokens ?? null);

  const setup = useMemo<CommerceSetup | null>(
    () => (contextId ? createSetup(contextId, edgeUrl, JSON.parse(tokensKey), isEditing) : null),
    [contextId, edgeUrl, tokensKey, isEditing]
  );

  const configError = useMemo(
    () =>
      setup
        ? null
        : new CommerceError(
            'CommerceProvider: api.edge.clientContextId is not configured in SitecoreProvider.',
            { source: 'sdk' }
          ),
    [setup]
  );

  const [session, setSession] = useState<ShopperSession | null>(null);
  const [status, setStatus] = useState<CommerceStatus>(configError ? 'error' : 'idle');
  const [error, setError] = useState<CommerceError | null>(configError);
  const [lastSessionChange, setLastSessionChange] = useState<SessionChangeEvent | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [shopper, setShopper] = useState<ShopperState>(IDLE_SHOPPER);

  // identity version, bumped synchronously by session events so loads can read it immediately
  const versionRef = useRef(0);
  const shopperRef = useRef<{ version: number; controller: AbortController | null } | null>(null);
  const setupRef = useRef(setup);

  useEffect(() => {
    // reset only when the setup changes after mount; child effects may already have updated state
    if (setupRef.current !== setup) {
      setupRef.current = setup;
      setSession(null);
      setLastSessionChange(null);
      setShopper(IDLE_SHOPPER);
      setError(configError);
      setStatus(configError ? 'error' : 'idle');
      shopperRef.current?.controller?.abort();
      shopperRef.current = null;
    }

    if (!setup) return undefined;

    let active = true;
    const unsubscribe = setup.service.sessionManager.subscribe((event) => {
      if (!active) return;
      setSession(event.session);
      if (event.reason !== 'refreshed') {
        versionRef.current += 1;
        setSessionVersion(versionRef.current);
        setLastSessionChange(event);
      }
    });

    // pick up an existing session cookie without any network request
    Promise.resolve(setup.tokenStore.get(DEFAULT_TOKEN_KEY))
      .then((stored) => {
        if (active && isSessionUsable(stored)) {
          setSession((current) => current ?? stored);
          setStatus((current) => (current === 'idle' ? 'ready' : current));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unsubscribe();
      shopperRef.current?.controller?.abort();
    };
  }, [setup, configError]);

  const runSessionOperation = useCallback(
    async (operation: (service: OrderCloudService) => Promise<ShopperSession>) => {
      if (!setup) throw configError as CommerceError;
      setStatus((current) => (current === 'ready' ? current : 'loading'));
      try {
        const next = await operation(setup.service);
        setSession((current) =>
          current?.accessToken === next.accessToken && current.expiresAt === next.expiresAt
            ? current
            : next
        );
        setStatus('ready');
        setError(null);
        return next;
      } catch (err) {
        const normalized = toError(err);
        setStatus('error');
        setError(normalized);
        throw normalized;
      }
    },
    [setup, configError]
  );

  const ensureSession = useCallback(
    () => runSessionOperation((service) => service.auth.getSession()),
    [runSessionOperation]
  );

  const resetSession = useCallback(
    () => runSessionOperation((service) => service.auth.reset()),
    [runSessionOperation]
  );

  const loadShopper = useCallback(
    async (force = false): Promise<void> => {
      if (!setup) {
        setShopper({ user: null, status: 'error', error: configError });
        return;
      }

      try {
        await ensureSession();
      } catch (err) {
        setShopper({ user: null, status: 'error', error: toError(err) });
        return;
      }

      // read after ensureSession: acquiring a session bumps the version synchronously
      const version = versionRef.current;
      if (!force && shopperRef.current?.version === version) return;

      shopperRef.current?.controller?.abort();
      const controller = new AbortController();
      shopperRef.current = { version, controller };
      // identity change clears the previous user; an explicit refetch keeps it while loading
      setShopper((current) => ({
        user: force ? current.user : null,
        status: 'loading',
        error: null,
      }));

      try {
        const user = await setup.service.me.get({ signal: controller.signal });
        if (controller.signal.aborted || versionRef.current !== version) return;
        setShopper({ user, status: 'success', error: null });
      } catch (err) {
        if (controller.signal.aborted || isAborted(err)) return;
        // keep the error until refetch() or an identity change; do not retry automatically
        setShopper({ user: null, status: 'error', error: toError(err) });
      }
    },
    [setup, configError, ensureSession]
  );

  useEffect(() => {
    if (eager && setup) ensureSession().catch(() => undefined);
  }, [eager, setup, ensureSession]);

  const userType = session?.userType ?? null;

  const value = useMemo<CommerceContextValue>(
    () => ({
      service: setup?.service ?? null,
      session,
      userType,
      isAnonymous: userType === 'anonymous',
      status,
      error,
      ensureSession,
      resetSession,
      isEditing,
      lastSessionChange,
    }),
    [
      setup,
      session,
      userType,
      status,
      error,
      ensureSession,
      resetSession,
      isEditing,
      lastSessionChange,
    ]
  );

  const internal = useMemo<CommerceInternalContextValue>(
    () => ({ sessionVersion, shopper, loadShopper }),
    [sessionVersion, shopper, loadShopper]
  );

  return (
    <CommerceContext.Provider value={value}>
      <CommerceInternalContext.Provider value={internal}>{children}</CommerceInternalContext.Provider>
    </CommerceContext.Provider>
  );
};

CommerceProvider.displayName = 'CommerceProvider';

/**
 * Low-level access to the commerce provider: the OrderCloud service, the current session and
 * session operations. Does not make any request by itself.
 * @returns {CommerceContextValue} commerce context
 * @throws {Error} when used outside a `CommerceProvider`
 * @public
 */
export function useCommerce(): CommerceContextValue {
  const context = useContext(CommerceContext);
  if (!context) {
    throw new Error('useCommerce must be used within a CommerceProvider.');
  }
  return context;
}

/**
 * Internal commerce context for hooks.
 * @returns {CommerceInternalContextValue} internal context
 * @throws {Error} when used outside a `CommerceProvider`
 * @internal
 */
export function useCommerceInternal(): CommerceInternalContextValue {
  const context = useContext(CommerceInternalContext);
  if (!context) {
    throw new Error('Commerce hooks must be used within a CommerceProvider.');
  }
  return context;
}
