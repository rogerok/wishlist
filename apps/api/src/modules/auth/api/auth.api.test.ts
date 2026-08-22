import { NodeHttpServer } from '@effect/platform-node';
import { describe, it } from '@effect/vitest';
import { Effect, Layer, Schema } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';

import {
  authGroupIdentifier,
  authLogoutPath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInternalHttpError,
  AuthInvalidCredentialsHttpError,
  AuthUnauthenticatedHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { authGroup } from '#modules/auth/api/auth.api.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

const email = 'user@example.test';
const password = (() => 'Password1!')();
const publicUser = Schema.decodeSync(UserResponseSchema)({
  id: '00000000-0000-4000-8000-000000000000',
  email,
  firstName: null,
  lastName: null,
  middleName: null,
});
const headers = { 'content-type': 'application/json' };

const unexpectedHandler = (operation: AuthOperation) => () =>
  Effect.die(new Error(`Unexpected ${operation} handler call`));

const TestApi = HttpApi.make('auth-contract-test').add(authGroup);
const TestPositiveApiAuthHandlersLive = HttpApiBuilder.group(
  TestApi,
  authGroupIdentifier,
  (handlers) =>
    handlers
      .handle(AuthOperation.signup, () => Effect.succeed(publicUser))
      .handle(AuthOperation.login, () => Effect.succeed(publicUser))
      .handle(AuthOperation.me, () => Effect.succeed(publicUser))
      .handle(AuthOperation.logout, () => Effect.void),
);
const TestPositiveAppLive = HttpApiBuilder.layer(TestApi).pipe(
  Layer.provide(TestPositiveApiAuthHandlersLive),
  Layer.provide(NodeHttpServer.layerHttpServices),
);
const appPositive = HttpRouter.toWebHandler(TestPositiveAppLive, {
  disableLogger: true,
});

const TestNegativeApiAuthHandlersLive = HttpApiBuilder.group(
  TestApi,
  authGroupIdentifier,
  (handlers) =>
    handlers
      .handle(AuthOperation.signup, () => new AuthEmailAlreadyExistsHttpError())
      .handle(AuthOperation.login, () => new AuthInvalidCredentialsHttpError())
      .handle(AuthOperation.me, () => new AuthUnauthenticatedHttpError())
      .handle(
        AuthOperation.logout,
        () => new AuthUnavailableHttpError({ instance: authLogoutPath }),
      ),
);
const TestNegativeAppLive = HttpApiBuilder.layer(TestApi).pipe(
  Layer.provide(TestNegativeApiAuthHandlersLive),
  Layer.provide(NodeHttpServer.layerHttpServices),
);
const appNegative = HttpRouter.toWebHandler(TestNegativeAppLive, {
  disableLogger: true,
});

const TestInternalApiAuthHandlersLive = HttpApiBuilder.group(
  TestApi,
  authGroupIdentifier,
  (handlers) =>
    handlers
      .handle(
        AuthOperation.signup,
        () => new AuthInternalHttpError({ instance: authSignupPath }),
      )
      .handle(AuthOperation.login, unexpectedHandler(AuthOperation.login))
      .handle(AuthOperation.me, unexpectedHandler(AuthOperation.me))
      .handle(AuthOperation.logout, unexpectedHandler(AuthOperation.logout)),
);
const TestInternalAppLive = HttpApiBuilder.layer(TestApi).pipe(
  Layer.provide(TestInternalApiAuthHandlersLive),
  Layer.provide(NodeHttpServer.layerHttpServices),
);
const appInternal = HttpRouter.toWebHandler(TestInternalAppLive, {
  disableLogger: true,
});

afterAll(async () => {
  await appPositive.dispose();
  await appNegative.dispose();
  await appInternal.dispose();
});

describe('/api/auth/signup', () => {
  const makeRequest = () =>
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
        passwordConfirm: password,
        firstName: null,
        middleName: null,
        lastName: null,
      }),
    });

  it('success signup test', async () => {
    const request = makeRequest();
    const resp = await appPositive.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(UserResponseSchema)(json);

    expect(resp.status).toBe(201);
    expect(body).toEqual(publicUser);
  });

  it('fail signup test', async () => {
    const request = makeRequest();
    const resp = await appNegative.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(AuthEmailAlreadyExistsHttpError)(
      json,
    );

    expect(resp.status).toBe(409);
    expect(resp.headers.get('content-type')).toBe('application/problem+json');
    expect(body).toBeInstanceOf(AuthEmailAlreadyExistsHttpError);
  });

  it('fail signup test with internal error', async () => {
    const request = makeRequest();
    const resp = await appInternal.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(AuthInternalHttpError)(json);

    expect(resp.status).toBe(500);
    expect(resp.headers.get('content-type')).toBe('application/problem+json');
    expect(body).toBeInstanceOf(AuthInternalHttpError);
    expect(body.instance).toBe(authSignupPath);
  });
});

describe('/api/auth/login', () => {
  const makeRequest = () =>
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
      }),
    });

  it('success login test', async () => {
    const request = makeRequest();
    const resp = await appPositive.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(UserResponseSchema)(json);

    expect(resp.status).toBe(200);
    expect(body).toEqual(publicUser);
  });

  it('failure login test', async () => {
    const request = makeRequest();
    const resp = await appNegative.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(AuthInvalidCredentialsHttpError)(
      json,
    );

    expect(resp.status).toBe(401);
    expect(resp.headers.get('content-type')).toBe('application/problem+json');
    expect(body).toBeInstanceOf(AuthInvalidCredentialsHttpError);
  });
});

describe('/api/auth/logout', () => {
  const makeRequest = () =>
    new Request('http://localhost/api/auth/logout', {
      method: 'POST',
    });

  it('success logout test', async () => {
    const request = makeRequest();

    const resp = await appPositive.handler(request);
    const body = await resp.text();

    expect(resp.status).toBe(204);
    expect(body).toBe('');
  });

  it('failure logout test', async () => {
    const request = makeRequest();

    const resp = await appNegative.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(AuthUnavailableHttpError)(json);

    expect(resp.status).toBe(503);
    expect(resp.headers.get('content-type')).toBe('application/problem+json');
    expect(body).toBeInstanceOf(AuthUnavailableHttpError);
  });
});

describe('/api/auth/me', () => {
  const makeRequest = () =>
    new Request('http://localhost/api/auth/me', {
      method: 'GET',
    });

  it('success me test', async () => {
    const request = makeRequest();

    const resp = await appPositive.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(UserResponseSchema)(json);

    expect(resp.status).toBe(200);
    expect(body).toEqual(publicUser);
  });

  it('failure me test', async () => {
    const request = makeRequest();

    const resp = await appNegative.handler(request);
    const json = await resp.json();
    const body = Schema.decodeUnknownSync(AuthUnauthenticatedHttpError)(json);

    expect(resp.status).toBe(401);
    expect(resp.headers.get('content-type')).toBe('application/problem+json');

    expect(body).toBeInstanceOf(AuthUnauthenticatedHttpError);
  });
});
