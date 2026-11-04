import { expect } from 'chai';
import { decodeSessionCookie, encodeSessionCookie, getCommerceCookieNames } from './cookie-codec';
import { encodeBase64Url } from '../token/base64url';

describe('cookie-codec', () => {
  describe('getCommerceCookieNames', () => {
    it('should use unsuffixed names for the default key', () => {
      expect(getCommerceCookieNames()).to.deep.equal({ session: 'sc_oc_s', refresh: 'sc_oc_rt' });
      expect(getCommerceCookieNames('default')).to.deep.equal({
        session: 'sc_oc_s',
        refresh: 'sc_oc_rt',
      });
    });

    it('should suffix and sanitize other keys', () => {
      expect(getCommerceCookieNames('en-US/x')).to.deep.equal({
        session: 'sc_oc_s_en-USx',
        refresh: 'sc_oc_rt_en-USx',
      });
    });

    it('should reject keys without valid characters', () => {
      expect(() => getCommerceCookieNames('!!')).to.throw('Invalid commerce token key');
    });
  });

  describe('encode/decode', () => {
    const session = { accessToken: 'at.b.c', expiresAt: 123, userType: 'registered' as const };

    it('should round-trip the access portion and never include the refresh token', () => {
      const value = encodeSessionCookie({ ...session, refreshToken: 'secret-rt' });
      expect(value.startsWith('v1.')).to.equal(true);
      expect(value).to.match(/^[A-Za-z0-9._-]+$/);
      expect(value).not.to.include('secret-rt');
      expect(decodeSessionCookie(value)).to.deep.equal(session);
    });

    it('should return null for missing, malformed or unknown-version values', () => {
      expect(decodeSessionCookie(undefined)).to.equal(null);
      expect(decodeSessionCookie('')).to.equal(null);
      expect(decodeSessionCookie('v2.abc')).to.equal(null);
      expect(decodeSessionCookie('v1.***')).to.equal(null);
      expect(decodeSessionCookie(`v1.${encodeBase64Url('null')}`)).to.equal(null);
    });

    it('should return null for payloads with invalid fields', () => {
      const encode = (payload: unknown) => `v1.${encodeBase64Url(JSON.stringify(payload))}`;
      expect(decodeSessionCookie(encode({ at: '', exp: 1, ut: 'anonymous' }))).to.equal(null);
      expect(decodeSessionCookie(encode({ at: 'a', exp: 'x', ut: 'anonymous' }))).to.equal(null);
      expect(decodeSessionCookie(encode({ at: 'a', exp: 1, ut: 'admin' }))).to.equal(null);
    });
  });
});
