import { expect } from 'chai';
import sinon from 'sinon';
import { SessionChangeEvent, ShopperSessionManager } from './shopper-session-manager';
import { CommerceTokenClient, TokenClientResult } from '../token/token-client';
import { createMemoryTokenStore } from '../token-store/memory-token-store';
import { CommerceTokenStore } from '../token-store/token-store';
import { CommerceError } from '../errors';
import { ShopperSession } from '../models';

const future = () => Date.now() + 600_000;
const anon = (id = 'anon'): ShopperSession => ({
  accessToken: id,
  expiresAt: future(),
  userType: 'anonymous',
});
const registered = (id = 'reg', refreshToken = 'rt'): ShopperSession => ({
  accessToken: id,
  expiresAt: future(),
  userType: 'registered',
  refreshToken,
});
const expired = (session: ShopperSession): ShopperSession => ({ ...session, expiresAt: Date.now() - 1 });
const result = (session: ShopperSession, persisted = false): TokenClientResult => ({
  session,
  persisted,
});

type FakeClient = CommerceTokenClient & {
  getAnonymousToken: sinon.SinonStub;
  refresh: sinon.SinonStub;
  clear: sinon.SinonStub;
};

const createClient = (serverManagedRefresh = false): FakeClient => {
  let n = 0;
  return {
    serverManagedRefresh,
    getAnonymousToken: sinon.stub().callsFake(async () => result(anon(`anon-${++n}`))),
    refresh: sinon.stub().callsFake(async () => result(registered(`reg-${++n}`))),
    clear: sinon.stub().resolves(),
  };
};

const setup = (options: { serverManagedRefresh?: boolean; store?: CommerceTokenStore } = {}) => {
  const tokenClient = createClient(options.serverManagedRefresh);
  const tokenStore = options.store ?? createMemoryTokenStore();
  const manager = new ShopperSessionManager({ tokenClient, tokenStore });
  const events: SessionChangeEvent[] = [];
  manager.subscribe((event) => events.push(event));
  return { tokenClient, tokenStore, manager, events };
};

describe('ShopperSessionManager', () => {
  describe('ensureSession', () => {
    it('should return a usable stored session without I/O or events', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      const stored = anon('stored');
      tokenStore.set('default', stored);

      expect(await manager.ensureSession()).to.deep.equal(stored);
      expect(manager.peek()).to.deep.equal(stored);
      expect(tokenClient.getAnonymousToken.called).to.equal(false);
      expect(events).to.deep.equal([]);
    });

    it('should acquire an anonymous session when none exists and persist it', async () => {
      const { manager, tokenStore, events } = setup();

      const session = await manager.ensureSession();

      expect(session.userType).to.equal('anonymous');
      expect(await tokenStore.get('default')).to.deep.equal(session);
      expect(events).to.deep.equal([{ reason: 'acquired', session }]);
    });

    it('should not persist sessions already persisted by the token client', async () => {
      const store = createMemoryTokenStore();
      const setSpy = sinon.spy(store, 'set');
      const { manager, tokenClient } = setup({ store });
      tokenClient.getAnonymousToken.resolves(result(anon('server'), true));

      await manager.ensureSession();

      expect(setSpy.called).to.equal(false);
      expect(manager.peek()?.accessToken).to.equal('server');
    });

    it('should replace an expired anonymous session without attempting a refresh', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      tokenStore.set('default', expired(anon('old')));

      const session = await manager.ensureSession();

      expect(tokenClient.refresh.called).to.equal(false);
      expect(session.accessToken).to.equal('anon-1');
      expect(events).to.deep.equal([
        { reason: 'replaced', session, previousUserType: 'anonymous' },
      ]);
    });

    it('should report replaced when an in-memory session expired and the cookie disappeared', async () => {
      const { manager, tokenStore, events } = setup();
      await manager.ensureSession();
      tokenStore.clear('default');
      // simulate expiry of the in-memory copy
      (manager.peek() as ShopperSession).expiresAt = 0;

      await manager.ensureSession();

      expect(events.map((e) => e.reason)).to.deep.equal(['acquired', 'replaced']);
      expect(events[1].previousUserType).to.equal('anonymous');
    });

    it('should refresh an expired registered session', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      tokenStore.set('default', expired(registered('old', 'rt-old')));

      const session = await manager.ensureSession();

      expect(tokenClient.refresh.calledOnceWith('rt-old')).to.equal(true);
      expect(tokenClient.getAnonymousToken.called).to.equal(false);
      expect(events).to.deep.equal([{ reason: 'refreshed', session }]);
    });

    it('should fall back to anonymous when the refresh is rejected', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      tokenStore.set('default', expired(registered()));
      tokenClient.refresh.rejects(
        new CommerceError('expired', { source: 'ordercloud', status: 400, code: 'invalid_grant' })
      );

      const session = await manager.ensureSession();

      expect(session.userType).to.equal('anonymous');
      expect(events).to.deep.equal([
        { reason: 'replaced', session, previousUserType: 'registered' },
      ]);
    });

    it('should surface network/server errors without replacing the session', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      const stale = expired(registered());
      tokenStore.set('default', stale);
      tokenClient.refresh.rejects(new CommerceError('down', { source: 'ordercloud', status: 503 }));

      const error = await manager.ensureSession().catch((e) => e);

      expect(error.status).to.equal(503);
      expect(tokenClient.getAnonymousToken.called).to.equal(false);
      expect(await tokenStore.get('default')).to.deep.equal(stale);
      expect(events).to.deep.equal([]);
    });

    it('should not refresh a registered session without a refresh token (edge client)', async () => {
      const { manager, tokenStore, tokenClient } = setup();
      tokenStore.set('default', {
        accessToken: 'r',
        expiresAt: Date.now() - 1,
        userType: 'registered',
      });

      await manager.ensureSession();

      expect(tokenClient.refresh.called).to.equal(false);
      expect(tokenClient.getAnonymousToken.calledOnce).to.equal(true);
    });

    it('should make a single upstream call for concurrent callers', async () => {
      const { manager, tokenClient } = setup();

      const sessions = await Promise.all([
        manager.ensureSession(),
        manager.ensureSession(),
        manager.ensureSession(),
      ]);

      expect(tokenClient.getAnonymousToken.calledOnce).to.equal(true);
      expect(new Set(sessions.map((s) => s.accessToken)).size).to.equal(1);
    });

    it('should re-read the store inside the flight and reuse a session renewed elsewhere', async () => {
      const store = createMemoryTokenStore();
      const renewed = anon('other-tab');
      let reads = 0;
      const racyStore: CommerceTokenStore = {
        get: (key) => (++reads === 1 ? null : renewed) ?? store.get(key),
        set: store.set,
        clear: store.clear,
      };
      const { manager, tokenClient } = setup({ store: racyStore });

      expect(await manager.ensureSession()).to.deep.equal(renewed);
      expect(tokenClient.getAnonymousToken.called).to.equal(false);
    });

    it('should reuse the in-memory session when the store cannot persist (e.g. cookies blocked)', async () => {
      const blackHole: CommerceTokenStore = {
        get: () => null,
        set: () => undefined,
        clear: () => undefined,
      };
      const { manager, tokenClient, events } = setup({ store: blackHole });

      const first = await manager.ensureSession();
      const second = await manager.ensureSession();

      expect(second).to.equal(first);
      expect(tokenClient.getAnonymousToken.calledOnce).to.equal(true);
      expect(events.map((e) => e.reason)).to.deep.equal(['acquired']);
    });

    it('should isolate listener errors', async () => {
      const { manager } = setup();
      manager.subscribe(() => {
        throw new Error('listener');
      });
      expect((await manager.ensureSession()).userType).to.equal('anonymous');
    });

    it('should support unsubscribing', async () => {
      const { manager } = setup();
      const listener = sinon.spy();
      const unsubscribe = manager.subscribe(listener);
      unsubscribe();
      await manager.ensureSession();
      expect(listener.called).to.equal(false);
    });
  });

  describe('server-managed refresh (route handler client)', () => {
    it('should ask the server for a session when nothing is stored', async () => {
      const { manager, tokenClient, events } = setup({ serverManagedRefresh: true });
      tokenClient.getAnonymousToken.resolves(result(registered('from-refresh-cookie', undefined), true));

      const session = await manager.ensureSession();

      expect(tokenClient.refresh.called).to.equal(false);
      expect(session.userType).to.equal('registered');
      expect(events).to.deep.equal([{ reason: 'acquired', session }]);
    });

    it('should delegate refresh of a registered session even without a client-side refresh token', async () => {
      const { manager, tokenStore, tokenClient, events } = setup({ serverManagedRefresh: true });
      tokenStore.set('default', { accessToken: 'r', expiresAt: Date.now() - 1, userType: 'registered' });

      const session = await manager.ensureSession();

      expect(tokenClient.refresh.calledOnce).to.equal(true);
      expect(events).to.deep.equal([{ reason: 'refreshed', session }]);
    });

    it('should report replaced when the server re-mints an expired anonymous session', async () => {
      const { manager, tokenStore, tokenClient, events } = setup({ serverManagedRefresh: true });
      tokenStore.set('default', expired(anon('old')));
      tokenClient.refresh.resolves(result(anon('new'), true));

      const session = await manager.ensureSession();

      expect(session.accessToken).to.equal('new');
      expect(events).to.deep.equal([
        { reason: 'replaced', session, previousUserType: 'anonymous' },
      ]);
    });
  });

  describe('invalidate', () => {
    it('should renew a rejected session even if it looks usable', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      tokenStore.set('default', anon('rejected'));

      const session = await manager.invalidate('rejected');

      expect(session.accessToken).to.equal('anon-1');
      expect(tokenClient.getAnonymousToken.calledOnce).to.equal(true);
      expect(events[0]).to.include({ reason: 'replaced', previousUserType: 'anonymous' });
    });

    it('should reuse a newer session if the rejected token was already replaced', async () => {
      const { manager, tokenStore, tokenClient } = setup();
      tokenStore.set('default', anon('newer'));

      expect((await manager.invalidate('rejected')).accessToken).to.equal('newer');
      expect(tokenClient.getAnonymousToken.called).to.equal(false);
    });

    it('should force a server refresh with the route handler client', async () => {
      const { manager, tokenStore, tokenClient } = setup({ serverManagedRefresh: true });
      tokenStore.set('default', anon('rejected'));
      tokenClient.refresh.resolves(result(anon('server-new'), true));

      expect((await manager.invalidate('rejected')).accessToken).to.equal('server-new');
      expect(tokenClient.refresh.calledOnce).to.equal(true);
    });
  });

  describe('reset', () => {
    it('should clear storage and mint a new anonymous session', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      tokenStore.set('default', registered());

      const session = await manager.reset();

      expect(tokenClient.clear.calledOnce).to.equal(true);
      expect(session.userType).to.equal('anonymous');
      expect(await tokenStore.get('default')).to.deep.equal(session);
      expect(events).to.deep.equal([
        { reason: 'replaced', session, previousUserType: 'registered' },
      ]);
    });

    it('should report acquired when there was no previous session', async () => {
      const { manager, events } = setup();
      await manager.reset();
      expect(events[0].reason).to.equal('acquired');
    });

    it('should wait for an in-flight acquisition before resetting', async () => {
      const { manager, tokenClient } = setup();
      const ensure = manager.ensureSession();
      // let ensureSession start its flight
      await new Promise((resolve) => setTimeout(resolve, 0));
      const reset = manager.reset();
      const [first, second] = await Promise.all([ensure, reset]);
      expect(tokenClient.getAnonymousToken.calledTwice).to.equal(true);
      expect(first.accessToken).not.to.equal(second.accessToken);
      expect(manager.peek()?.accessToken).to.equal(second.accessToken);
    });
  });

  describe('clear', () => {
    it('should clear storage and emit cleared', async () => {
      const { manager, tokenStore, tokenClient, events } = setup();
      await manager.ensureSession();

      await manager.clear();

      expect(await tokenStore.get('default')).to.equal(null);
      expect(manager.peek()).to.equal(null);
      expect(tokenClient.clear.calledOnce).to.equal(true);
      expect(events[1]).to.deep.equal({ reason: 'cleared', session: null });
    });
  });
});
