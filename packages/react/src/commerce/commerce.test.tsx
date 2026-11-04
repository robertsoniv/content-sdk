/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { act, render, waitFor } from '@testing-library/react';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import {
  CommerceError,
  EdgeTokenClient,
  OrderCloudService,
  RouteHandlerTokenClient,
  ShopperSession,
  createBrowserCookieTokenStore,
} from '@sitecore-content-sdk/commerce';
import { SitecoreProviderReactContext, SitecoreProviderState } from '../components/SitecoreProvider';
import { CommerceContextValue, CommerceProvider, CommerceTokenOptions, useCommerce } from './CommerceProvider';
import { useShopper, UseShopperState } from './useShopper';

const NOT_EDITING = { isEditing: false, isPreview: false, isDesignLibrary: false };

const providerState = (mode: Partial<typeof NOT_EDITING> = {}, clientContextId = 'client-ctx') =>
  (({
    api: { edge: { contextId: 'ctx', clientContextId, edgeUrl: 'https://edge.test' } },
    page: { mode: { ...NOT_EDITING, ...mode } },
  } as unknown) as SitecoreProviderState);

const ROUTE_HANDLER: CommerceTokenOptions = { mode: 'route-handler', cookies: { secure: false } };

const session = (accessToken: string, userType: 'anonymous' | 'registered' = 'anonymous') => ({
  accessToken,
  expiresAt: Date.now() + 600_000,
  userType,
});

const clearCookies = () => {
  document.cookie.split(/;\s*/).forEach((part) => {
    const name = part.split('=')[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  });
};

let commerce: CommerceContextValue;
const CommerceProbe = () => {
  commerce = useCommerce();
  return <span id="status">{commerce.status}</span>;
};

const ShopperProbe = ({ id = 'shopper', enabled }: { id?: string; enabled?: boolean }) => {
  const state: UseShopperState = useShopper({ enabled });
  return (
    <span id={id}>
      {JSON.stringify({
        user: state.user?.ID ?? null,
        status: state.status,
        userType: state.userType,
        isAnonymous: state.isAnonymous,
        isRegistered: state.isRegistered,
        isLoading: state.isLoading,
        isSuccess: state.isSuccess,
        isError: state.isError,
        error: state.error?.message ?? null,
      })}
    </span>
  );
};

let refetchShopper: () => Promise<void>;
const RefetchProbe = () => {
  refetchShopper = useShopper().refetch;
  return null;
};

const readShopper = (container: HTMLElement, id = 'shopper') =>
  JSON.parse(container.querySelector(`#${id}`)?.textContent || '{}');

const renderCommerce = (
  ui: React.ReactNode,
  {
    state = providerState(),
    tokens = ROUTE_HANDLER,
    eager,
  }: { state?: SitecoreProviderState; tokens?: CommerceTokenOptions; eager?: boolean } = {}
) =>
  render(
    <SitecoreProviderReactContext.Provider value={state}>
      <CommerceProvider tokens={tokens} eager={eager}>
        <CommerceProbe />
        {ui}
      </CommerceProvider>
    </SitecoreProviderReactContext.Provider>
  );

describe('commerce (react)', () => {
  let sandbox: SinonSandbox;
  let routeAnonymous: SinonStub;
  let routeRefresh: SinonStub;
  let edgeAnonymous: SinonStub;
  let request: SinonStub;
  let tokenCount: number;

  beforeEach(() => {
    sandbox = createSandbox();
    tokenCount = 0;
    const next = (userType: 'anonymous' | 'registered' = 'anonymous') => ({
      session: session(`at-${++tokenCount}`, userType),
      persisted: true,
    });
    routeAnonymous = sandbox
      .stub(RouteHandlerTokenClient.prototype, 'getAnonymousToken')
      .callsFake(async () => next());
    routeRefresh = sandbox
      .stub(RouteHandlerTokenClient.prototype, 'refresh')
      .callsFake(async () => next());
    sandbox.stub(RouteHandlerTokenClient.prototype, 'clear').resolves();
    edgeAnonymous = sandbox
      .stub(EdgeTokenClient.prototype, 'getAnonymousToken')
      .callsFake(async () => ({ ...next(), persisted: false }));
    request = sandbox
      .stub(OrderCloudService.prototype, 'request')
      .callsFake(async () => ({ ID: `user-${tokenCount}`, Username: 'u' }));
  });

  afterEach(() => {
    sandbox.restore();
    clearCookies();
  });

  describe('useCommerce', () => {
    it('should throw outside a CommerceProvider', () => {
      const original = console.error;
      console.error = () => undefined;
      try {
        expect(() => render(<CommerceProbe />)).to.throw('within a CommerceProvider');
      } finally {
        console.error = original;
      }
    });

    it('should report a configuration error when the client context ID is missing', async () => {
      const { container } = renderCommerce(<ShopperProbe />, {
        state: providerState({}, ''),
      });

      await waitFor(() => expect(readShopper(container).status).to.equal('error'));
      expect(commerce.status).to.equal('error');
      expect(commerce.service).to.equal(null);
      expect(commerce.error?.message).to.include('clientContextId');
      expect(readShopper(container).error).to.include('clientContextId');
      const rejected = await commerce.ensureSession().catch((e) => e);
      expect(rejected).to.be.instanceOf(CommerceError);
      expect(await commerce.resetSession().catch((e) => e)).to.be.instanceOf(CommerceError);
    });

    it('should be lazy: no token request until a hook needs a session', async () => {
      renderCommerce(null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(routeAnonymous.called).to.be.false;
      expect(commerce.status).to.equal('idle');
      expect(commerce.session).to.equal(null);
      expect(commerce.isEditing).to.be.false;
    });

    it('should acquire a session on mount when eager', async () => {
      renderCommerce(null, { eager: true });
      await waitFor(() => expect(commerce.status).to.equal('ready'));
      expect(routeAnonymous.calledOnce).to.be.true;
      expect(commerce.userType).to.equal('anonymous');
      expect(commerce.isAnonymous).to.be.true;
      expect(commerce.lastSessionChange?.reason).to.equal('acquired');
    });

    it('should pick up an existing session cookie without any request', async () => {
      const existing = session('existing');
      createBrowserCookieTokenStore({ cookies: { secure: false } }).set('default', existing);

      renderCommerce(null);

      await waitFor(() => expect(commerce.status).to.equal('ready'));
      expect(commerce.session?.accessToken).to.equal('existing');
      expect(routeAnonymous.called).to.be.false;
    });

    it('should use the Edge token client and memory storage in editing modes', async () => {
      for (const mode of [{ isEditing: true }, { isPreview: true }, { isDesignLibrary: true }]) {
        const { unmount } = renderCommerce(null, { state: providerState(mode), eager: true });
        await waitFor(() => expect(commerce.status).to.equal('ready'));
        expect(commerce.isEditing).to.be.true;
        unmount();
      }
      expect(edgeAnonymous.callCount).to.equal(3);
      expect(routeAnonymous.called).to.be.false;
      expect(document.cookie).not.to.include('sc_oc_s');
    });

    it('should use the Edge token client in browser mode', async () => {
      renderCommerce(null, {
        tokens: { mode: 'browser', refreshTokenStorage: 'memory', cookies: { secure: false } },
        eager: true,
      });
      await waitFor(() => expect(commerce.status).to.equal('ready'));
      expect(edgeAnonymous.calledOnce).to.be.true;
      expect(document.cookie).to.include('sc_oc_s=');
    });

    it('should reset state when the setup changes (e.g. entering editing mode)', async () => {
      const ui = (state: SitecoreProviderState) => (
        <SitecoreProviderReactContext.Provider value={state}>
          <CommerceProvider tokens={ROUTE_HANDLER} eager>
            <CommerceProbe />
          </CommerceProvider>
        </SitecoreProviderReactContext.Provider>
      );
      const { rerender } = render(ui(providerState()));
      await waitFor(() => expect(commerce.status).to.equal('ready'));
      const firstService = commerce.service;

      rerender(ui(providerState({ isEditing: true })));

      await waitFor(() => expect(commerce.isEditing).to.be.true);
      expect(commerce.service).not.to.equal(firstService);
      await waitFor(() => expect(edgeAnonymous.calledOnce).to.be.true);
    });

    it('should expose session errors', async () => {
      routeAnonymous.rejects(new CommerceError('down', { source: 'network' }));
      renderCommerce(null);
      const error = await act(() => commerce.ensureSession().catch((e) => e));
      expect(error.message).to.equal('down');
      await waitFor(() => expect(commerce.status).to.equal('error'));
      expect(commerce.error?.message).to.equal('down');
    });

    it('should normalize non-commerce errors', async () => {
      routeAnonymous.rejects(new TypeError('boom'));
      renderCommerce(null);
      const error = await act(() => commerce.ensureSession().catch((e) => e));
      expect(error).to.be.instanceOf(CommerceError);
      expect(error.message).to.equal('boom');
    });
  });

  describe('useShopper', () => {
    it('should load the anonymous shopper with a single /v1/me request shared by consumers', async () => {
      const { container } = renderCommerce(
        <>
          <ShopperProbe id="a" />
          <ShopperProbe id="b" />
        </>
      );

      await waitFor(() => expect(readShopper(container, 'a').status).to.equal('success'));
      expect(readShopper(container, 'a')).to.deep.equal({
        user: 'user-1',
        status: 'success',
        userType: 'anonymous',
        isAnonymous: true,
        isRegistered: false,
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
      });
      expect(readShopper(container, 'b').user).to.equal('user-1');
      expect(routeAnonymous.calledOnce).to.be.true;
      expect(request.calledOnce).to.be.true;
      expect(request.firstCall.args[0]).to.equal('/v1/me');
    });

    it('should report registered shoppers', async () => {
      routeAnonymous.callsFake(async () => ({ session: session('reg', 'registered'), persisted: true }));
      const { container } = renderCommerce(<ShopperProbe />);
      await waitFor(() => expect(readShopper(container).status).to.equal('success'));
      expect(readShopper(container)).to.include({ isRegistered: true, isAnonymous: false });
    });

    it('should not load when disabled', async () => {
      const { container } = renderCommerce(<ShopperProbe enabled={false} />);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(readShopper(container).status).to.equal('idle');
      expect(request.called).to.be.false;
      expect(routeAnonymous.called).to.be.false;
    });

    it('should refetch and expose lastSessionChange when the identity is replaced', async () => {
      const { container } = renderCommerce(<ShopperProbe />);
      await waitFor(() => expect(readShopper(container).user).to.equal('user-1'));

      await act(async () => {
        await commerce.resetSession();
      });

      await waitFor(() => expect(readShopper(container).user).to.equal('user-2'));
      expect(request.calledTwice).to.be.true;
      expect(commerce.lastSessionChange).to.deep.include({
        reason: 'replaced',
        previousUserType: 'anonymous',
      });
    });

    it('should not refetch on a plain token refresh', async () => {
      // registered sessions inside the expiry buffer are refreshed on every ensureSession
      const almostExpired = (accessToken: string): ShopperSession => ({
        accessToken,
        expiresAt: Date.now() + 1_000,
        userType: 'registered',
      });
      routeAnonymous.callsFake(async () => ({ session: almostExpired('reg-1'), persisted: true }));
      routeRefresh.callsFake(async () => ({ session: almostExpired('reg-2'), persisted: true }));

      const { container } = renderCommerce(<ShopperProbe />, {
        tokens: { mode: 'route-handler', cookies: { secure: false } },
      });
      await waitFor(() => expect(readShopper(container).status).to.equal('success'));

      await act(async () => {
        await commerce.ensureSession();
      });

      expect(routeRefresh.called).to.be.true;
      expect(commerce.session?.accessToken).to.equal('reg-2');
      expect(commerce.lastSessionChange?.reason).to.equal('acquired');
      expect(request.calledOnce).to.be.true;
    });

    it('should expose /v1/me errors and recover on refetch', async () => {
      request.onFirstCall().rejects(new CommerceError('forbidden', { source: 'ordercloud', status: 403 }));
      const { container } = renderCommerce(
        <>
          <ShopperProbe />
          <RefetchProbe />
        </>
      );

      await waitFor(() => expect(readShopper(container).isError).to.be.true);
      expect(readShopper(container).error).to.equal('forbidden');
      // errors are not retried automatically
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(request.calledOnce).to.be.true;
      expect(readShopper(container).isError).to.be.true;

      await act(async () => {
        await refetchShopper();
      });
      await waitFor(() => expect(readShopper(container).status).to.equal('success'));
    });

    it('should expose session errors', async () => {
      routeAnonymous.rejects(new CommerceError('no session', { source: 'network' }));
      const { container } = renderCommerce(<ShopperProbe />);
      await waitFor(() => expect(readShopper(container).status).to.equal('error'));
      expect(readShopper(container).error).to.equal('no session');
      expect(request.called).to.be.false;
    });

    it('should abort the in-flight /v1/me request on unmount', async () => {
      let signal: AbortSignal | undefined;
      request.callsFake(
        (_path: string, init: RequestInit) =>
          new Promise(() => {
            signal = init.signal ?? undefined;
          })
      );
      const { unmount } = renderCommerce(<ShopperProbe />);
      await waitFor(() => expect(signal).not.to.equal(undefined));

      unmount();

      expect(signal?.aborted).to.be.true;
    });

    it('should throw outside a CommerceProvider', () => {
      const original = console.error;
      console.error = () => undefined;
      try {
        expect(() => render(<ShopperProbe />)).to.throw('within a CommerceProvider');
      } finally {
        console.error = original;
      }
    });
  });
});
