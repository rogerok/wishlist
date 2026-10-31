import { Schema } from 'effect';

import { makePageSchema } from '#infra/pagination/page.js';

// Элемент с собственным кодированием: в JSON дата уходит строкой, как у WishlistResponseSchema.
const TestItem = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.DateFromString,
});

const TestPage = makePageSchema(TestItem);

const encode = Schema.encodeUnknownResult(TestPage);
const decode = Schema.decodeUnknownResult(TestPage);

const createdAt = '2026-10-01T10:00:00.123Z';

describe('makePageSchema', () => {
  it('encodes an empty last page', () => {
    expect(encode({ items: [], nextCursor: null })).toBeResultSuccess({
      items: [],
      nextCursor: null,
    });
  });

  it('encodes each item with the item schema', () => {
    expect(
      encode({
        items: [{ id: 'a', createdAt: new Date(createdAt) }],
        nextCursor: null,
      }),
    ).toBeResultSuccess({ items: [{ id: 'a', createdAt }], nextCursor: null });
  });

  it('keeps the next cursor string unchanged', () => {
    expect(
      encode({ items: [], nextCursor: 'eyJzb3J0IjoiYSJ9' }),
    ).toBeResultSuccess({
      items: [],
      nextCursor: 'eyJzb3J0IjoiYSJ9',
    });
  });

  it('requires nextCursor, because the client tells the last page by null', () => {
    expect(decode({ items: [] })).toBeResultSchemaFailure([
      expect.objectContaining({ path: ['nextCursor'] }),
    ]);
  });
});
