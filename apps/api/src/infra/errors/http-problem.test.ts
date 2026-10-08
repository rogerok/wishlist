import { describe, expect, it } from '@effect/vitest';

import { toRequestPathname } from '#infra/errors/http-problem.js';

describe('toRequestPathname', () => {
  it.each([
    { originalUrl: '/api/users', pathname: '/api/users' },
    { originalUrl: '//api/users', pathname: '//api/users' },
    { originalUrl: '///api/users', pathname: '///api/users' },
    { originalUrl: '/api/users?email=a%40b.test#top', pathname: '/api/users' },
    { originalUrl: '//api/users#top', pathname: '//api/users' },
    { originalUrl: 'http://localhost/api/users?x=1', pathname: '/api/users' },
    { originalUrl: 'http://localhost//api/users', pathname: '//api/users' },
    { originalUrl: 'http://localhost', pathname: '/' },
    { originalUrl: '*', pathname: '/' },
  ])('$originalUrl → $pathname', ({ originalUrl, pathname }) => {
    expect(toRequestPathname(originalUrl)).toBe(pathname);
  });
});
