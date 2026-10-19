import { Effect, Schema } from 'effect';

import { requestParseOptions } from '#infra/api/request-parse-options.js';
import { makeCursorCodec } from '#infra/pagination/cursor.js';
import { cursorMatchesSort, LimitQueryParam } from '#infra/pagination/query.js';
import { Uuid4Schema } from '#infra/schemas/uuid4.schema.js';

// Query тестового списка, собранная так же, как её соберёт список Wishlist.
const TestCursor = makeCursorCodec(
  Schema.Union([
    Schema.Struct({ sort: Schema.Literal('createdAt'), id: Uuid4Schema }),
    Schema.Struct({ sort: Schema.Literal('occasionDate'), id: Uuid4Schema }),
  ]),
);

const TestQueryFields = Schema.Struct({
  sort: Schema.Literals(['createdAt', 'occasionDate']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('createdAt' as const)),
  ),
  cursor: Schema.optionalKey(TestCursor),
  limit: LimitQueryParam,
});

const TestQuery =
  TestQueryFields.check(cursorMatchesSort<typeof TestQueryFields.Type>());

const decode = (query: unknown) =>
  Schema.decodeUnknownResult(TestQuery)(query, requestParseOptions);

const id = '3f8c2a4e-1b7d-4c9a-8e2f-5a6b7c8d9e0f';
const cursorOf = (sort: string) =>
  Buffer.from(JSON.stringify({ sort, id })).toString('base64url');

describe('list query', () => {
  it('applies the default sort and limit to an empty query', () => {
    expect(decode({})).toBeResultSuccess({ sort: 'createdAt', limit: 20 });
  });

  it.each(['1', '100'])('accepts limit %s', (limit) => {
    expect(decode({ limit })).toBeResultSuccess({
      sort: 'createdAt',
      limit: Number(limit),
    });
  });

  it.each([
    '0',
    '101',
    '-1',
    '+5',
    '05',
    '1.5',
    '1e1',
    '0x10',
    ' 5',
    'abc',
    '',
  ])('rejects limit %j', (limit) => {
    expect(decode({ limit })).toBeResultSchemaFailure([
      expect.objectContaining({ path: ['limit'] }),
    ]);
  });

  it('rejects a repeated limit, which arrives as an array', () => {
    expect(decode({ limit: ['1', '2'] })).toBeResultSchemaFailure([
      expect.objectContaining({ path: ['limit'] }),
    ]);
  });

  it.each(['title', 'CREATEDAT', 'created_at', ''])(
    'rejects sort %j, which the list does not have',
    (sort) => {
      expect(decode({ sort })).toBeResultSchemaFailure([
        expect.objectContaining({ path: ['sort'] }),
      ]);
    },
  );

  it('accepts a cursor of the selected sort', () => {
    expect(
      decode({ sort: 'occasionDate', cursor: cursorOf('occasionDate') }),
    ).toBeResultSuccess({
      sort: 'occasionDate',
      cursor: { sort: 'occasionDate', id },
      limit: 20,
    });
  });

  it('rejects a cursor of another sort at the cursor path', () => {
    expect(
      decode({ sort: 'createdAt', cursor: cursorOf('occasionDate') }),
    ).toBeResultSchemaFailure([expect.objectContaining({ path: ['cursor'] })]);
  });

  it('rejects a cursor of another sort when sort falls back to the default', () => {
    expect(
      decode({ cursor: cursorOf('occasionDate') }),
    ).toBeResultSchemaFailure([expect.objectContaining({ path: ['cursor'] })]);
  });
});
