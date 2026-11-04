/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import sinon from 'sinon';
import { NextRequest, NextResponse } from 'next/server';
import { CommerceError, EdgeTokenClient } from '@sitecore-content-sdk/commerce';
import { encodeSessionCookie } from '@sitecore-content-sdk/commerce/internal';
import { createCommerceTokenRouteHandler } from './commerce-token-route-handler';

const URL_BASE = 'https://shop.test/api/commerce/token';

const future = () => Date.now() + 600_000;

const createRequest = (
  method: 'POST' | 'DELETE',
  {
    body = '{}',
    headers = {},
    cookies = {},
    sameOrigin = true,
  }: {
    body?: string | null;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    sameOrigin?: boolean;
  } = {}
) => {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(URL_BASE, {
    method,
    headers: {
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      ...(sameOrigin ? { 'sec-fetch-site': 'same-origin' } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...headers,
    },
    ...(method === 'POST' && body !== null ? { body } : {}),
  });
};

const setCookies = (response: NextResponse) => response.cookies.getAll();
const findCookie = (response: NextResponse, name: string) =>
  response.cookies.getAll().find((cookie) => cookie.name === name);

describe('createCommerceTokenRouteHandler', () => {
  const sandbox = sinon.createSandbox();
  let anonymous: sinon.SinonStub;
  let refresh: sinon.SinonStub;
  let n: number;

  const handler = (options: Partial<Parameters<typeof createCommerceTokenRouteHandler>[0]> = {}) =>
    createCommerceTokenRouteHandler({ contextId: 'ctx', edgeUrl: 'https://edge.test', ...options });

  beforeEach(() => {
    n = 0;
    anonymous = sandbox.stub(EdgeTokenClient.prototype, 'getAnonymousToken').callsFake(async () => ({
      session: { accessToken: `anon-${++n}`, expiresAt: future(), userType: 'anonymous' },
      persisted: false,
    }));
    refresh = sandbox.stub(EdgeTokenClient.prototype, 'refresh').callsFake(async (rt) => ({
      session: {
        accessToken: `reg-${++n}`,
        expiresAt: future(),
        userType: 'registered',
        refreshToken: `${rt}-rotated`,
      },
      persisted: false,
    }));
  });

  afterEach(() => sandbox.restore());

  describe('POST', () => {
    it('should mint an anonymous session and set only the JS-readable session cookie', async () => {
      const response = await handler().POST(createRequest('POST'));

      expect(response.status).to.equal(200);
      expect(response.headers.get('cache-control')).to.equal('no-store');
      const body = await response.json();
      expect(body).to.have.keys('accessToken', 'expiresAt', 'userType');
      expect(body).to.include({ accessToken: 'anon-1', userType: 'anonymous' });

      const session = findCookie(response, 'sc_oc_s');
      expect(session?.value).to.match(/^v1\./);
      expect(session).to.include({ path: '/', secure: true, sameSite: 'lax', httpOnly: false });
      expect(session?.maxAge).to.be.within(599, 600);
      expect(findCookie(response, 'sc_oc_rt')).to.equal(undefined);
    });

    it('should accept an empty body', async () => {
      const response = await handler().POST(createRequest('POST', { body: '' }));
      expect(response.status).to.equal(200);
    });

    it('should return a usable session without calling upstream or setting cookies', async () => {
      const existing = { accessToken: 'existing', expiresAt: future(), userType: 'anonymous' as const };
      const response = await handler().POST(
        createRequest('POST', { cookies: { sc_oc_s: encodeSessionCookie(existing) } })
      );

      expect(await response.json()).to.include({ accessToken: 'existing' });
      expect(anonymous.called).to.be.false;
      expect(setCookies(response)).to.deep.equal([]);
    });

    it('should replace a usable anonymous session when forceRefresh is set', async () => {
      const existing = { accessToken: 'rejected', expiresAt: future(), userType: 'anonymous' as const };
      const response = await handler().POST(
        createRequest('POST', {
          body: JSON.stringify({ forceRefresh: true }),
          cookies: { sc_oc_s: encodeSessionCookie(existing) },
        })
      );

      expect(await response.json()).to.include({ accessToken: 'anon-1' });
      expect(refresh.called).to.be.false;
    });

    it('should refresh a registered session from the httpOnly refresh cookie', async () => {
      const response = await handler().POST(createRequest('POST', { cookies: { sc_oc_rt: 'rt-1' } }));

      expect(refresh.calledOnceWith('rt-1')).to.be.true;
      const body = await response.json();
      expect(body).to.include({ accessToken: 'reg-1', userType: 'registered' });
      expect(body).not.to.have.property('refreshToken');

      const refreshCookie = findCookie(response, 'sc_oc_rt');
      expect(refreshCookie).to.include({ value: 'rt-1-rotated', httpOnly: true, maxAge: 2592000 });
      expect(findCookie(response, 'sc_oc_s')?.httpOnly).to.equal(false);
    });

    it('should force-refresh a usable registered session', async () => {
      const existing = { accessToken: 'reg-old', expiresAt: future(), userType: 'registered' as const };
      await handler().POST(
        createRequest('POST', {
          body: JSON.stringify({ forceRefresh: true }),
          cookies: { sc_oc_s: encodeSessionCookie(existing), sc_oc_rt: 'rt-1' },
        })
      );
      expect(refresh.calledOnceWith('rt-1')).to.be.true;
    });

    it('should fall back to anonymous and delete the refresh cookie when the refresh is rejected', async () => {
      refresh.rejects(new CommerceError('expired', { source: 'ordercloud', status: 400 }));

      const response = await handler().POST(createRequest('POST', { cookies: { sc_oc_rt: 'bad' } }));

      expect(await response.json()).to.include({ userType: 'anonymous' });
      expect(findCookie(response, 'sc_oc_rt')?.maxAge).to.equal(0);
    });

    it('should return 502 without touching cookies on upstream failures', async () => {
      anonymous.rejects(new CommerceError('down', { source: 'network' }));

      const response = await handler().POST(createRequest('POST'));

      expect(response.status).to.equal(502);
      expect(await response.json()).to.deep.equal({ error: 'Commerce token request failed.' });
      expect(setCookies(response)).to.deep.equal([]);
    });

    it('should not leak unexpected error details', async () => {
      anonymous.rejects(new Error('secret detail'));
      const response = await handler().POST(createRequest('POST'));
      expect(response.status).to.equal(502);
      expect(JSON.stringify(await response.json())).not.to.include('secret detail');
    });

    it('should apply cookie options and scope', async () => {
      const response = await handler({
        cookies: { domain: '.shop.test', sameSite: 'strict', path: '/s' },
        scope: ['Shopper', 'MeAdmin'],
      }).POST(createRequest('POST'));

      expect(findCookie(response, 'sc_oc_s')).to.include({
        domain: '.shop.test',
        sameSite: 'strict',
        path: '/s',
      });
    });

    it('should reject cross-site requests', async () => {
      const response = await handler().POST(
        createRequest('POST', { sameOrigin: false, headers: { 'sec-fetch-site': 'cross-site' } })
      );
      expect(response.status).to.equal(403);
      expect(anonymous.called).to.be.false;
    });

    it('should fall back to Origin/Host checks without Sec-Fetch-Site', async () => {
      const ok = await handler().POST(
        createRequest('POST', {
          sameOrigin: false,
          headers: { origin: 'https://shop.test', host: 'shop.test' },
        })
      );
      expect(ok.status).to.equal(200);

      for (const headers of [
        { origin: 'https://evil.test', host: 'shop.test' },
        { host: 'shop.test' },
        { origin: 'not a url', host: 'shop.test' },
      ]) {
        const denied = await handler().POST(createRequest('POST', { sameOrigin: false, headers }));
        expect(denied.status, JSON.stringify(headers)).to.equal(403);
      }
    });

    it('should require a JSON content type', async () => {
      const response = await handler().POST(
        createRequest('POST', { headers: { 'content-type': 'text/plain' } })
      );
      expect(response.status).to.equal(415);
    });

    it('should reject invalid bodies', async () => {
      for (const body of ['{bad', '[]', '"x"', JSON.stringify({ forceRefresh: 'yes' })]) {
        const response = await handler().POST(createRequest('POST', { body }));
        expect(response.status, body).to.equal(400);
      }
      expect(anonymous.called).to.be.false;
    });

    it('should return 500 when the context ID is not configured', async () => {
      const response = await handler({ contextId: '' }).POST(createRequest('POST'));
      expect(response.status).to.equal(500);
    });
  });

  describe('DELETE', () => {
    it('should clear both commerce cookies', async () => {
      const response = await handler().DELETE(
        createRequest('DELETE', { cookies: { sc_oc_s: 'x', sc_oc_rt: 'y' } })
      );

      expect(response.status).to.equal(204);
      expect(response.headers.get('cache-control')).to.equal('no-store');
      expect(findCookie(response, 'sc_oc_s')?.maxAge).to.equal(0);
      expect(findCookie(response, 'sc_oc_rt')?.maxAge).to.equal(0);
    });

    it('should reject cross-site requests', async () => {
      const response = await handler().DELETE(
        createRequest('DELETE', { sameOrigin: false, headers: { 'sec-fetch-site': 'cross-site' } })
      );
      expect(response.status).to.equal(403);
    });
  });
});
