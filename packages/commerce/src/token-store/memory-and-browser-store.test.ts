import { expect } from 'chai';
import { createMemoryTokenStore } from './memory-token-store';
import { createBrowserCookieTokenStore, documentCookieAdapter } from './browser-cookie-token-store';

const session = { accessToken: 'at', expiresAt: Date.now() + 600_000, userType: 'anonymous' as const };

describe('createMemoryTokenStore', () => {
  it('should store copies per key and isolate instances', () => {
    const a = createMemoryTokenStore();
    const b = createMemoryTokenStore();
    a.set('default', session);

    const read = a.get('default') as typeof session;
    expect(read).to.deep.equal(session);
    read.accessToken = 'mutated';
    expect((a.get('default') as typeof session).accessToken).to.equal('at');
    expect(b.get('default')).to.equal(null);
  });

  it('should clear one key or all keys', () => {
    const store = createMemoryTokenStore();
    store.set('default', session);
    store.set('other', session);
    store.clear('other');
    expect(store.get('other')).to.equal(null);
    expect(store.get('default')).to.not.equal(null);
    store.clear();
    expect(store.get('default')).to.equal(null);
  });
});

describe('browser cookie store', () => {
  let writes: string[];
  let cookieString: string;

  const installDocument = () => {
    writes = [];
    cookieString = '';
    (global as { document?: unknown }).document = {
      get cookie() {
        return cookieString;
      },
      set cookie(value: string) {
        writes.push(value);
      },
    };
  };

  afterEach(() => {
    delete (global as { document?: unknown }).document;
  });

  describe('without document (SSR)', () => {
    it('should be a no-op', () => {
      const store = createBrowserCookieTokenStore();
      expect(store.get('default')).to.equal(null);
      expect(() => store.set('default', session)).not.to.throw();
      expect(() => store.clear()).not.to.throw();
    });
  });

  describe('documentCookieAdapter', () => {
    beforeEach(installDocument);

    it('should read and decode a cookie by exact name', () => {
      cookieString = 'sc_oc_s_x=nope; sc_oc_s=a%20b; other=1';
      expect(documentCookieAdapter.get('sc_oc_s')).to.equal('a b');
      expect(documentCookieAdapter.get('missing')).to.equal(null);
    });

    it('should return null for undecodable values', () => {
      cookieString = 'sc_oc_s=%E0%A4%A';
      expect(documentCookieAdapter.get('sc_oc_s')).to.equal(null);
    });

    it('should serialize attributes', () => {
      documentCookieAdapter.set('n', 'v 1', {
        path: '/',
        domain: '.x.com',
        sameSite: 'strict',
        secure: true,
        httpOnly: false,
        maxAge: 10,
      });
      expect(writes[0]).to.equal('n=v%201; Path=/; Domain=.x.com; Max-Age=10; SameSite=Strict; Secure');
    });

    it('should refuse to write httpOnly cookies', () => {
      expect(() =>
        documentCookieAdapter.set('n', 'v', {
          path: '/',
          sameSite: 'lax',
          secure: true,
          httpOnly: true,
          maxAge: 1,
        })
      ).to.throw('httpOnly');
    });

    it('should delete with matching attributes and max-age 0', () => {
      documentCookieAdapter.delete('n', { path: '/', sameSite: 'lax', secure: true });
      expect(writes[0]).to.equal('n=; Path=/; Max-Age=0; SameSite=Lax; Secure');
    });
  });

  describe('createBrowserCookieTokenStore', () => {
    beforeEach(installDocument);

    it('should default to not storing refresh tokens', () => {
      const store = createBrowserCookieTokenStore();
      store.set('default', { ...session, userType: 'registered', refreshToken: 'rt' });
      expect(writes).to.have.length(1);
      expect(writes[0].startsWith('sc_oc_s=v1.')).to.equal(true);
      expect(writes.join()).not.to.include('rt;');
    });

    it('should store a JS-readable refresh cookie when opted in', () => {
      const store = createBrowserCookieTokenStore({ refreshTokenStorage: 'cookie' });
      store.set('default', { ...session, userType: 'registered', refreshToken: 'rt' });
      expect(writes[1].startsWith('sc_oc_rt=rt;')).to.equal(true);
    });

    it('should never use localStorage or sessionStorage', () => {
      const trap = {
        getItem: () => {
          throw new Error('localStorage used');
        },
        setItem: () => {
          throw new Error('localStorage used');
        },
      };
      (global as { localStorage?: unknown }).localStorage = trap;
      (global as { sessionStorage?: unknown }).sessionStorage = trap;
      try {
        const store = createBrowserCookieTokenStore({ refreshTokenStorage: 'memory' });
        store.set('default', { ...session, userType: 'registered', refreshToken: 'rt' });
        store.get('default');
        store.clear();
      } finally {
        delete (global as { localStorage?: unknown }).localStorage;
        delete (global as { sessionStorage?: unknown }).sessionStorage;
      }
    });
  });
});
