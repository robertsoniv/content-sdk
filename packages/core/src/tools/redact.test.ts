import { expect } from 'chai';
import { hasHeader, redactBody, redactData, redactHeaders, redactUrl, REDACTED } from './redact';

describe('redact', () => {
  describe('hasHeader', () => {
    it('should return false for undefined headers', () => {
      expect(hasHeader(undefined, 'Content-Type')).to.equal(false);
    });

    it('should detect header in a plain record case-insensitively', () => {
      expect(hasHeader({ 'content-type': 'text/plain' }, 'Content-Type')).to.equal(true);
      expect(hasHeader({ Accept: 'text/plain' }, 'Content-Type')).to.equal(false);
    });

    it('should detect header in tuples', () => {
      expect(hasHeader([['Content-Type', 'text/plain']], 'content-type')).to.equal(true);
    });

    it('should detect header in a Headers-like object', () => {
      const headers = { has: (name: string) => name === 'Content-Type' } as unknown as Headers;
      expect(hasHeader(headers, 'Content-Type')).to.equal(true);
    });
  });

  describe('redactHeaders', () => {
    it('should redact credential headers and keep others', () => {
      expect(
        redactHeaders({
          Authorization: 'Bearer abc',
          cookie: 'a=b',
          'set-cookie': 'c=d',
          'x-sitecore-contextid': 'ctx',
        })
      ).to.deep.equal({
        Authorization: REDACTED,
        cookie: REDACTED,
        'set-cookie': REDACTED,
        'x-sitecore-contextid': 'ctx',
      });
    });

    it('should handle undefined', () => {
      expect(redactHeaders(undefined)).to.deep.equal({});
    });
  });

  describe('redactUrl', () => {
    it('should return URL unchanged when nothing is sensitive', () => {
      const url = 'https://x.io/v1/me?a=1&b=two%20words#frag';
      expect(redactUrl(url)).to.equal(url);
    });

    it('should redact sensitive query params and keep hash', () => {
      expect(redactUrl('https://x.io/v1/me/orders?anonUserToken=secret&x=1#h')).to.equal(
        `https://x.io/v1/me/orders?anonUserToken=${REDACTED}&x=1#h`
      );
    });

    it('should return URL without query unchanged', () => {
      expect(redactUrl('https://x.io/v1/me')).to.equal('https://x.io/v1/me');
    });
  });

  describe('redactData', () => {
    it('should redact sensitive keys recursively', () => {
      expect(
        redactData({
          access_token: 'a',
          refresh_token: 'r',
          accessToken: 'a2',
          nested: { Password: 'p', ok: 1 },
          list: [{ client_secret: 's' }],
        })
      ).to.deep.equal({
        access_token: REDACTED,
        refresh_token: REDACTED,
        accessToken: REDACTED,
        nested: { Password: REDACTED, ok: 1 },
        list: [{ client_secret: REDACTED }],
      });
    });

    it('should pass primitives through', () => {
      expect(redactData('text')).to.equal('text');
      expect(redactData(null)).to.equal(null);
      expect(redactData(undefined)).to.equal(undefined);
    });
  });

  describe('redactBody', () => {
    it('should redact form-encoded string bodies', () => {
      expect(redactBody('grant_type=password&username=u&password=p')).to.equal(
        `grant_type=password&username=u&password=${REDACTED}`
      );
    });

    it('should leave non-sensitive form bodies unchanged', () => {
      expect(redactBody('grant_type=client_credentials&scope=Shopper')).to.equal(
        'grant_type=client_credentials&scope=Shopper'
      );
    });

    it('should redact URLSearchParams bodies', () => {
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'rt' });
      expect(redactBody(body)).to.equal(`grant_type=refresh_token&refresh_token=${REDACTED}`);
    });

    it('should redact JSON string bodies', () => {
      expect(redactBody(JSON.stringify({ Username: 'u', Password: 'p' }))).to.equal(
        JSON.stringify({ Username: 'u', Password: REDACTED })
      );
    });

    it('should return invalid JSON-looking strings unchanged', () => {
      expect(redactBody('{not json')).to.equal('{not json');
    });

    it('should pass plain strings and empty bodies through', () => {
      expect(redactBody('hello')).to.equal('hello');
      expect(redactBody(undefined)).to.equal(undefined);
      expect(redactBody(null)).to.equal(null);
    });

    it('should not log non-text bodies', () => {
      expect(redactBody(new Uint8Array([1, 2]))).to.equal('[non-text body]');
    });
  });
});
