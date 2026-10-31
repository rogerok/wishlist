import { Schema } from 'effect';

import { makeCursorCodec } from '#infra/pagination/cursor.js';
import {
  PgCalendarDate,
  PgInstantFromString,
} from '#infra/schemas/dates.schema.js';
import { Uuid4Schema } from '#infra/schemas/uuid4.schema.js';

// Содержимое курсора задаёт потребитель; здесь — тестовое, той же формы, что у списка Wishlist.
const TestCursor = Schema.Union([
  Schema.Struct({
    sort: Schema.Literal('createdAt'),
    createdAt: PgInstantFromString,
    id: Uuid4Schema,
  }),
  Schema.Struct({
    sort: Schema.Literal('occasionDate'),
    asOf: PgCalendarDate,
    occasionDate: Schema.NullOr(PgCalendarDate),
    id: Uuid4Schema,
  }),
]);

const CursorCodec = makeCursorCodec(TestCursor);

const decode = Schema.decodeUnknownResult(CursorCodec);
const encode = Schema.encodeResult(CursorCodec);

const base64url = (text: string) => Buffer.from(text).toString('base64url');

const id = '3f8c2a4e-1b7d-4c9a-8e2f-5a6b7c8d9e0f';

const createdAtCursor = {
  sort: 'createdAt',
  createdAt: '2026-10-01T10:00:00.123Z',
  id,
} as const;

const occasionDateCursor = {
  sort: 'occasionDate',
  asOf: '2026-10-18',
  occasionDate: null,
  id,
} as const;

describe('makeCursorCodec', () => {
  it('decodes a base64url JSON cursor of the createdAt sort', () => {
    expect(
      decode(base64url(JSON.stringify(createdAtCursor))),
    ).toBeResultSuccess({
      ...createdAtCursor,
      createdAt: new Date(createdAtCursor.createdAt),
    });
  });

  it('decodes a base64url JSON cursor of the occasionDate sort', () => {
    expect(
      decode(base64url(JSON.stringify(occasionDateCursor))),
    ).toBeResultSuccess(occasionDateCursor);
  });

  it('encodes a cursor into base64url without padding', () => {
    expect(
      encode({
        ...createdAtCursor,
        createdAt: new Date(createdAtCursor.createdAt),
      }),
    ).toBeResultSuccess(base64url(JSON.stringify(createdAtCursor)));
  });

  it.each([
    { name: 'an empty string', value: '' },
    { name: 'text outside the base64url alphabet', value: 'not-base64!' },
    {
      name: 'base64url of text that is not JSON',
      value: base64url('not json'),
    },
    { name: 'base64url of an empty object', value: base64url('{}') },
    {
      name: 'base64url of a cursor without key values',
      value: base64url('{"sort":"createdAt"}'),
    },
    {
      name: 'base64url of a cursor of an unknown sort',
      value: base64url(JSON.stringify({ ...createdAtCursor, sort: 'title' })),
    },
  ])('rejects $name', ({ value }) => {
    expect(decode(value)).toBeResultSchemaFailure([expect.anything()]);
  });

  it.each([
    { name: 'id that is not a UUID', cursor: { ...createdAtCursor, id: 'x' } },
    {
      name: 'createdAt that does not exist',
      cursor: { ...createdAtCursor, createdAt: '2026-02-30T00:00:00.000Z' },
    },
    {
      name: 'createdAt in year 0000',
      cursor: { ...createdAtCursor, createdAt: '0000-01-01T00:00:00.000Z' },
    },
    {
      name: 'createdAt without time',
      cursor: { ...createdAtCursor, createdAt: '2026-10-01' },
    },
    {
      name: 'asOf that does not exist',
      cursor: { ...occasionDateCursor, asOf: '2026-02-30' },
    },
    {
      name: 'asOf in year 0000',
      cursor: { ...occasionDateCursor, asOf: '0000-01-01' },
    },
    {
      name: 'occasionDate in year 0000',
      cursor: { ...occasionDateCursor, occasionDate: '0000-01-01' },
    },
    {
      name: 'occasionDate without leading zeros',
      cursor: { ...occasionDateCursor, occasionDate: '2026-1-5' },
    },
  ])('rejects a well-formed cursor with $name', ({ cursor }) => {
    expect(decode(base64url(JSON.stringify(cursor)))).toBeResultSchemaFailure([
      expect.anything(),
    ]);
  });
});
