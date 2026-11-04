import { expect } from 'chai';
import { decodeBase64Url, encodeBase64Url } from './base64url';
import { isSessionUsable, readJwtClaims, toShopperSession } from './session-utils';
import { CommerceError } from '../errors';

/**
 * Builds an unsigned JWT for tests.
 * @param {object} claims JWT claims
 * @returns {string} JWT
 */
export const createTestJwt = (claims: Record<string, unknown>) =>
  `${encodeBase64Url(JSON.stringify({ alg: 'none' }))}.${encodeBase64Url(
    JSON.stringify(claims)
  )}.sig`;

describe('base64url', () => {
  it('should round-trip unicode strings without padding or unsafe characters', () => {
    const value = 'héllo ✓ ??>>';
    const encoded = encodeBase64Url(value);
    expect(encoded).to.match(/^[A-Za-z0-9_-]+$/);
    expect(decodeBase64Url(encoded)).to.equal(value);
  });

  it('should throw on invalid input', () => {
    expect(() => decodeBase64Url('***')).to.throw();
  });
});

describe('session-utils', () => {
  describe('readJwtClaims', () => {
    it('should decode JWT claims', () => {
      expect(readJwtClaims(createTestJwt({ exp: 10, usrtype: 'buyer' }))).to.deep.equal({
        exp: 10,
        usrtype: 'buyer',
      });
    });

    it('should return null for malformed tokens', () => {
      expect(readJwtClaims('abc')).to.equal(null);
      expect(readJwtClaims('a..c')).to.equal(null);
      expect(readJwtClaims(`a.${encodeBase64Url('not json')}.c`)).to.equal(null);
      expect(readJwtClaims(`a.${encodeBase64Url('[1]')}.c`)).to.equal(null);
      expect(readJwtClaims((undefined as unknown) as string)).to.equal(null);
    });
  });

  describe('toShopperSession', () => {
    it('should compute expiry from expires_in', () => {
      expect(
        toShopperSession({ access_token: 'at', expires_in: 600 }, 'anonymous', 1000)
      ).to.deep.equal({ accessToken: 'at', expiresAt: 601000, userType: 'anonymous' });
    });

    it('should include the refresh token when present', () => {
      expect(
        toShopperSession({ access_token: 'at', expires_in: 1, refresh_token: 'rt' }, 'registered', 0)
          .refreshToken
      ).to.equal('rt');
    });

    it('should fall back to the JWT exp claim', () => {
      const token = createTestJwt({ exp: 2000 });
      expect(toShopperSession({ access_token: token }, 'anonymous').expiresAt).to.equal(2000000);
    });

    it('should throw when there is no access token', () => {
      expect(() =>
        toShopperSession(({} as unknown) as { access_token: string }, 'anonymous')
      ).to.throw(CommerceError, 'access token');
    });

    it('should throw when no expiry can be determined', () => {
      expect(() => toShopperSession({ access_token: 'opaque' }, 'anonymous')).to.throw(
        CommerceError,
        'expiry'
      );
    });
  });

  describe('isSessionUsable', () => {
    const session = { accessToken: 'at', expiresAt: 100_000, userType: 'anonymous' as const };

    it('should return false for missing sessions', () => {
      expect(isSessionUsable(null)).to.equal(false);
      expect(isSessionUsable(undefined)).to.equal(false);
      expect(isSessionUsable({ ...session, accessToken: '' })).to.equal(false);
    });

    it('should apply the default 60s buffer', () => {
      expect(isSessionUsable(session, { now: 39_999 })).to.equal(true);
      expect(isSessionUsable(session, { now: 40_000 })).to.equal(false);
    });

    it('should apply a custom buffer', () => {
      expect(isSessionUsable(session, { now: 99_000, bufferMs: 0 })).to.equal(true);
      expect(isSessionUsable(session, { now: 100_000, bufferMs: 0 })).to.equal(false);
    });
  });
});
