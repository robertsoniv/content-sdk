import { expect } from 'chai';
import { createCookieTokenStore, resolveCookieAttributes } from './cookie-token-store';
import { CookieAdapter, CookieAttributes } from './token-store';
import { encodeSessionCookie } from './cookie-codec';

const createFakeAdapter = () => {
  const jar = new Map<string, { value: string; attributes: CookieAttributes }>();
  const deleted: string[] = [];
  const adapter: CookieAdapter = {
    get: (name) => jar.get(name)?.value ?? null,
    set: (name, value, attributes) => {
      jar.set(name, { value, attributes });
    },
    delete: (name) => {
      deleted.push(name);
      jar.delete(name);
    },
  };
  return { adapter, jar, deleted };
};

const NOW = 1_000_000;
const anonymous = { accessToken: 'anon', expiresAt: NOW + 600_000, userType: 'anonymous' as const };
const registered = {
  accessToken: 'reg',
  expiresAt: NOW + 36_000_000,
  userType: 'registered' as const,
  refreshToken: 'rt',
};

describe('resolveCookieAttributes', () => {
  it('should apply secure defaults', () => {
    expect(resolveCookieAttributes()).to.deep.equal({ path: '/', sameSite: 'lax', secure: true });
  });

  it('should apply overrides', () => {
    expect(
      resolveCookieAttributes({ domain: '.x.com', path: '/shop', sameSite: 'strict', secure: false })
    ).to.deep.equal({ domain: '.x.com', path: '/shop', sameSite: 'strict', secure: false });
  });
});

describe('createCookieTokenStore', () => {
  it('should write the session cookie with max-age following token expiry', () => {
    const { adapter, jar } = createFakeAdapter();
    const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'none', now: () => NOW });

    store.set('default', anonymous);

    const cookie = jar.get('sc_oc_s');
    expect(cookie?.value).to.equal(encodeSessionCookie(anonymous));
    expect(cookie?.attributes).to.deep.equal({
      path: '/',
      sameSite: 'lax',
      secure: true,
      httpOnly: false,
      maxAge: 600,
    });
    expect(store.get('default')).to.deep.equal(anonymous);
  });

  it('should clamp max-age at 0 for expired sessions', () => {
    const { adapter, jar } = createFakeAdapter();
    const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'none', now: () => NOW });
    store.set('default', { ...anonymous, expiresAt: NOW - 1 });
    expect(jar.get('sc_oc_s')?.attributes.maxAge).to.equal(0);
  });

  it('should return null when nothing is stored', () => {
    const { adapter } = createFakeAdapter();
    expect(createCookieTokenStore(adapter, { refreshTokenStorage: 'cookie' }).get('default')).to.equal(
      null
    );
  });

  describe('refreshTokenStorage: none', () => {
    it('should never store or return a refresh token', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'none', now: () => NOW });
      store.set('default', registered);
      expect(jar.has('sc_oc_rt')).to.equal(false);
      expect(store.get('default')).to.deep.equal({
        accessToken: 'reg',
        expiresAt: registered.expiresAt,
        userType: 'registered',
      });
    });
  });

  describe('refreshTokenStorage: memory', () => {
    it('should keep the refresh token in memory only', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'memory', now: () => NOW });
      store.set('default', registered);
      expect(jar.has('sc_oc_rt')).to.equal(false);
      expect(store.get('default')).to.deep.equal(registered);
    });

    it('should not survive a new store instance (reload)', () => {
      const { adapter } = createFakeAdapter();
      createCookieTokenStore(adapter, { refreshTokenStorage: 'memory', now: () => NOW }).set(
        'default',
        registered
      );
      const reloaded = createCookieTokenStore(adapter, { refreshTokenStorage: 'memory' });
      expect(reloaded.get('default')?.refreshToken).to.equal(undefined);
    });
  });

  describe('refreshTokenStorage: cookie / http-only', () => {
    it('should write a JS-readable refresh cookie in cookie mode', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, {
        refreshTokenStorage: 'cookie',
        cookies: { refreshTokenMaxAge: 100 },
        now: () => NOW,
      });
      store.set('default', registered);
      expect(jar.get('sc_oc_rt')).to.deep.equal({
        value: 'rt',
        attributes: { path: '/', sameSite: 'lax', secure: true, httpOnly: false, maxAge: 100 },
      });
    });

    it('should write an httpOnly refresh cookie with the default 30-day max-age in http-only mode', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, {
        refreshTokenStorage: 'http-only',
        now: () => NOW,
      });
      store.set('default', registered);
      expect(jar.get('sc_oc_rt')?.attributes.httpOnly).to.equal(true);
      expect(jar.get('sc_oc_rt')?.attributes.maxAge).to.equal(2_592_000);
      expect(store.get('default')).to.deep.equal(registered);
    });

    it('should never write a refresh cookie for anonymous sessions and delete a stale one', () => {
      const { adapter, jar, deleted } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, {
        refreshTokenStorage: 'http-only',
        now: () => NOW,
      });
      store.set('default', registered);
      store.set('default', { ...anonymous, refreshToken: 'should-not-store' });
      expect(jar.has('sc_oc_rt')).to.equal(false);
      expect(deleted).to.include('sc_oc_rt');
    });

    it('should not issue a refresh cookie deletion when none exists', () => {
      const { adapter, deleted } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'http-only', now: () => NOW });
      store.set('default', anonymous);
      expect(deleted).to.deep.equal([]);
    });

    it('should keep the existing refresh cookie when a registered session has none', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'cookie', now: () => NOW });
      store.set('default', registered);
      store.set('default', { ...registered, accessToken: 'reg2', refreshToken: undefined });
      expect(jar.get('sc_oc_rt')?.value).to.equal('rt');
    });

    it('should return an expired registered placeholder when only the refresh cookie remains', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'cookie', now: () => NOW });
      store.set('default', registered);
      jar.delete('sc_oc_s');
      expect(store.get('default')).to.deep.equal({
        accessToken: '',
        expiresAt: 0,
        userType: 'registered',
        refreshToken: 'rt',
      });
    });

    it('should not attach a refresh token to an anonymous session', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'cookie', now: () => NOW });
      store.set('default', anonymous);
      jar.set('sc_oc_rt', { value: 'stray', attributes: {} as CookieAttributes });
      expect(store.get('default')).to.deep.equal(anonymous);
    });
  });

  describe('clear', () => {
    it('should clear both cookies for a key', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'cookie', now: () => NOW });
      store.set('default', registered);
      store.clear('default');
      expect(jar.size).to.equal(0);
    });

    it('should clear every key the store has written when no key is given', () => {
      const { adapter, jar } = createFakeAdapter();
      const store = createCookieTokenStore(adapter, { refreshTokenStorage: 'memory', now: () => NOW });
      store.set('default', registered);
      store.set('other', anonymous);
      store.clear();
      expect(jar.size).to.equal(0);
      expect(store.get('default')).to.equal(null);
    });
  });
});
