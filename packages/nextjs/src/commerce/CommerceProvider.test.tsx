/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { render, waitFor } from '@testing-library/react';
import { RouteHandlerTokenClient, EdgeTokenClient } from '@sitecore-content-sdk/commerce';
import {
  SitecoreProviderReactContext,
  SitecoreProviderState,
} from '@sitecore-content-sdk/react';
import { CommerceProvider, useCommerce, CommerceContextValue } from './index';

describe('nextjs CommerceProvider', () => {
  const sandbox = sinon.createSandbox();
  let commerce: CommerceContextValue;
  const Probe = () => {
    commerce = useCommerce();
    return null;
  };
  const state = ({
    api: { edge: { clientContextId: 'client', edgeUrl: 'https://edge.test' } },
    page: { mode: { isEditing: false, isPreview: false, isDesignLibrary: false } },
  } as unknown) as SitecoreProviderState;

  afterEach(() => sandbox.restore());

  it('should default to route-handler mode', async () => {
    const routeHandler = sandbox.stub(RouteHandlerTokenClient.prototype, 'getAnonymousToken').resolves({
      session: { accessToken: 'at', expiresAt: Date.now() + 600_000, userType: 'anonymous' },
      persisted: true,
    });
    const edge = sandbox.stub(EdgeTokenClient.prototype, 'getAnonymousToken');

    render(
      <SitecoreProviderReactContext.Provider value={state}>
        <CommerceProvider eager>
          <Probe />
        </CommerceProvider>
      </SitecoreProviderReactContext.Provider>
    );

    await waitFor(() => expect(commerce.status).to.equal('ready'));
    expect(routeHandler.calledOnce).to.be.true;
    expect(edge.called).to.be.false;
  });

  it('should accept explicit token options', async () => {
    const edge = sandbox.stub(EdgeTokenClient.prototype, 'getAnonymousToken').resolves({
      session: { accessToken: 'at', expiresAt: Date.now() + 600_000, userType: 'anonymous' },
      persisted: false,
    });

    render(
      <SitecoreProviderReactContext.Provider value={state}>
        <CommerceProvider
          eager
          tokens={{ mode: 'browser', refreshTokenStorage: 'memory', cookies: { secure: false } }}
        >
          <Probe />
        </CommerceProvider>
      </SitecoreProviderReactContext.Provider>
    );

    await waitFor(() => expect(commerce.status).to.equal('ready'));
    expect(edge.calledOnce).to.be.true;
  });
});
