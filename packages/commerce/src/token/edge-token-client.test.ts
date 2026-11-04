import { expect } from 'chai';
import nock from 'nock';
import { EdgeTokenClient } from './edge-token-client';
import { CommerceError } from '../errors';

const EDGE = 'https://edge.test';
const contextId = 'ctx-123';

describe('EdgeTokenClient', () => {
  afterEach(() => nock.cleanAll());

  const tokenScope = () =>
    nock(EDGE, {
      reqheaders: {
        'x-sitecore-contextid': contextId,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
    });

  it('should require a context ID', () => {
    expect(() => new EdgeTokenClient({ contextId: '' })).to.throw(CommerceError, 'contextId');
  });

  it('should mint an anonymous token with the Shopper scope and no client credentials', async () => {
    let body = '';
    tokenScope()
      .post('/oc/storefront/oauth/token', (b) => {
        body = typeof b === 'string' ? b : new URLSearchParams(b).toString();
        return true;
      })
      .reply(200, { access_token: 'anon-at', expires_in: 5_184_000, token_type: 'bearer' });

    const before = Date.now();
    const result = await new EdgeTokenClient({ contextId, edgeUrl: EDGE }).getAnonymousToken();

    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).to.equal('client_credentials');
    expect(params.get('scope')).to.equal('Shopper');
    expect(params.has('client_id')).to.equal(false);
    expect(params.has('client_secret')).to.equal(false);
    expect(result.persisted).to.equal(false);
    expect(result.session.accessToken).to.equal('anon-at');
    expect(result.session.userType).to.equal('anonymous');
    expect(result.session.refreshToken).to.equal(undefined);
    expect(result.session.expiresAt).to.be.at.least(before + 5_184_000_000);
  });

  it('should send a custom scope', async () => {
    let body = '';
    tokenScope()
      .post('/oc/storefront/oauth/token', (b) => {
        body = typeof b === 'string' ? b : new URLSearchParams(b).toString();
        return true;
      })
      .reply(200, { access_token: 'x', expires_in: 1 });

    await new EdgeTokenClient({
      contextId,
      edgeUrl: EDGE,
      scope: ['Shopper', 'MeAdmin'],
    }).getAnonymousToken();
    expect(new URLSearchParams(body).get('scope')).to.equal('Shopper MeAdmin');
  });

  it('should refresh a registered session and keep the refresh token when none is returned', async () => {
    let body = '';
    tokenScope()
      .post('/oc/storefront/oauth/token', (b) => {
        body = typeof b === 'string' ? b : new URLSearchParams(b).toString();
        return true;
      })
      .reply(200, { access_token: 'reg-at', expires_in: 36_000 });

    const result = await new EdgeTokenClient({ contextId, edgeUrl: EDGE }).refresh('rt-1');
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).to.equal('refresh_token');
    expect(params.get('refresh_token')).to.equal('rt-1');
    expect(result.session.userType).to.equal('registered');
    expect(result.session.refreshToken).to.equal('rt-1');
  });

  it('should use a rotated refresh token when returned', async () => {
    tokenScope()
      .post('/oc/storefront/oauth/token')
      .reply(200, { access_token: 'reg-at', expires_in: 1, refresh_token: 'rt-2' });

    const result = await new EdgeTokenClient({ contextId, edgeUrl: EDGE }).refresh('rt-1');
    expect(result.session.refreshToken).to.equal('rt-2');
  });

  it('should reject refresh without a refresh token', async () => {
    const error = await new EdgeTokenClient({ contextId, edgeUrl: EDGE })
      .refresh(undefined)
      .catch((e) => e);
    expect(error).to.be.instanceOf(CommerceError);
    expect(error.source).to.equal('sdk');
  });

  it('should mint a registered token with the password grant', async () => {
    let body = '';
    tokenScope()
      .post('/oc/storefront/oauth/token', (b) => {
        body = typeof b === 'string' ? b : new URLSearchParams(b).toString();
        return true;
      })
      .reply(200, { access_token: 'reg', expires_in: 36_000, refresh_token: 'rt' });

    const result = await new EdgeTokenClient({ contextId, edgeUrl: EDGE }).getPasswordToken(
      'user',
      'p@ss'
    );
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).to.equal('password');
    expect(params.get('username')).to.equal('user');
    expect(params.get('password')).to.equal('p@ss');
    expect(params.get('scope')).to.equal('Shopper');
    expect(result.session).to.include({ userType: 'registered', refreshToken: 'rt' });
  });

  it('should map OAuth errors', async () => {
    tokenScope()
      .post('/oc/storefront/oauth/token')
      .reply(400, { error: 'invalid_grant', error_description: 'expired' });

    const error = await new EdgeTokenClient({ contextId, edgeUrl: EDGE })
      .refresh('bad')
      .catch((e) => e);
    expect(error).to.be.instanceOf(CommerceError);
    expect(error).to.include({ status: 400, source: 'ordercloud', code: 'invalid_grant' });
  });

  it('should map plain-text proxy errors', async () => {
    tokenScope()
      .post('/oc/storefront/oauth/token')
      .reply(400, 'Missing context', { 'Content-Type': 'text/plain' });

    const error = await new EdgeTokenClient({ contextId, edgeUrl: EDGE })
      .getAnonymousToken()
      .catch((e) => e);
    expect(error).to.include({ status: 400, source: 'proxy' });
  });

  it('should re-throw caller aborts unchanged', async () => {
    const abortingFetch = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abort = new Error('aborted');
          abort.name = 'AbortError';
          reject(abort);
        });
      });
    const controller = new AbortController();
    const pending = new EdgeTokenClient({
      contextId,
      edgeUrl: EDGE,
      fetch: abortingFetch as typeof fetch,
    }).getAnonymousToken({ signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e) => e);
    expect(error).not.to.be.instanceOf(CommerceError);
    expect(error.name).to.equal('AbortError');
  });
});
