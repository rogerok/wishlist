import { describe, expect, it } from '@effect/vitest';
import { Effect, Result, Schema } from 'effect';
import * as TestClock from 'effect/testing/TestClock';

import { WishlistResponseSchema } from '#modules/wishlists/schemas/wishlist-response.schema.js';
import {
  CalendarDateInWindow,
  WishlistOccasionDateInputSchema,
  WishlistOccasionDateSchema,
  WishlistSchema,
} from '#modules/wishlists/schemas/wishlist.schema.js';

// Окно при этом времени: 2026-10-11 … 2031-10-12 включительно.
const now = Date.parse('2026-10-12T12:00:00Z');
const windowMessage = 'Expected a date between 2026-10-11 and 2031-10-12';

const decodeInWindow = (value: unknown) =>
  Effect.result(Schema.decodeUnknownEffect(CalendarDateInWindow)(value));

const datesInWindow = [
  { name: 'yesterday', value: '2026-10-11' },
  { name: 'today', value: '2026-10-12' },
  { name: 'today plus five years', value: '2031-10-12' },
] as const;

const datesOutsideWindow = [
  { name: 'the day before yesterday', value: '2026-10-10' },
  { name: 'today plus five years and one day', value: '2031-10-13' },
  { name: 'year 0000', value: '0000-01-01' },
] as const;

describe('CalendarDateInWindow', () => {
  it.effect.each(datesInWindow)('accepts $name', ({ value }) =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(yield* decodeInWindow(value)).toBeResultSuccess(value);
    }),
  );

  it.effect.each(datesOutsideWindow)('rejects $name', ({ value }) =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(yield* decodeInWindow(value)).toBeResultSchemaFailure([
        expect.objectContaining({ message: windowMessage }),
      ]);
    }),
  );

  it.effect('reports the calendar error before the window error', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(yield* decodeInWindow('2027-02-29')).toBeResultSchemaFailure([
        expect.objectContaining({
          message: 'Expected a calendar date YYYY-MM-DD',
        }),
      ]);
    }),
  );

  it.effect('uses the UTC date, not the time of day', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-12T23:59:59Z'));

      expect(yield* decodeInWindow('2026-10-11')).toBeResultSuccess(
        '2026-10-11',
      );
      expect(yield* decodeInWindow('2026-10-10')).toBeResultSchemaFailure([
        expect.objectContaining({ message: windowMessage }),
      ]);
    }),
  );

  it.effect('limits February 29 plus five years to February 28', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2028-02-29T12:00:00Z'));

      expect(yield* decodeInWindow('2033-02-28')).toBeResultSuccess(
        '2033-02-28',
      );
      expect(yield* decodeInWindow('2033-03-01')).toBeResultSchemaFailure([
        expect.objectContaining({
          message: 'Expected a date between 2028-02-28 and 2033-02-28',
        }),
      ]);
    }),
  );

  it.effect('reads the clock on every decode', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      expect(yield* decodeInWindow('2026-10-11')).toBeResultSuccess(
        '2026-10-11',
      );

      yield* TestClock.adjust('1 day');

      expect(yield* decodeInWindow('2026-10-11')).toBeResultSchemaFailure([
        expect.objectContaining({
          message: 'Expected a date between 2026-10-12 and 2031-10-13',
        }),
      ]);
    }),
  );
});

// Ключ occasionDate обязателен в теле (ADR-0007): его отсутствие — отказ, а не null.
const OccasionDateBody = Schema.Struct({
  occasionDate: WishlistOccasionDateInputSchema,
});

const decodeBody = (body: unknown) =>
  Effect.result(Schema.decodeUnknownEffect(OccasionDateBody)(body));

describe('WishlistOccasionDateInputSchema', () => {
  it.effect('accepts null without reading the window', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(yield* decodeBody({ occasionDate: null })).toBeResultSuccess({
        occasionDate: null,
      });
    }),
  );

  it.effect('accepts a date in the window', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(
        yield* decodeBody({ occasionDate: '2026-10-11' }),
      ).toBeResultSuccess({ occasionDate: '2026-10-11' });
    }),
  );

  it.effect('rejects a date outside the window', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(
        yield* decodeBody({ occasionDate: '2026-10-10' }),
      ).toBeResultSchemaFailure([
        expect.objectContaining({
          path: ['occasionDate'],
          message: windowMessage,
        }),
      ]);
    }),
  );

  it.effect('rejects a body without the occasionDate key', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);

      expect(yield* decodeBody({})).toBeResultSchemaFailure([
        expect.objectContaining({ path: ['occasionDate'] }),
      ]);
    }),
  );
});

describe('WishlistOccasionDateSchema', () => {
  it('reads a past date without the window', () => {
    const result = Schema.decodeResult(WishlistOccasionDateSchema)(
      '2020-02-29',
    );

    expect(result).toBeResultSuccess('2020-02-29');
  });

  it('reads null', () => {
    const result = Schema.decodeResult(WishlistOccasionDateSchema)(null);

    expect(result).toBeResultSuccess(null);
  });

  it('rejects a date that does not exist', () => {
    const result = Schema.decodeResult(WishlistOccasionDateSchema)(
      '2027-02-29',
    );

    expect(result).toBeResultSchemaFailure([expect.anything()]);
  });
});

// Строка в том виде, в каком её отдаёт PostgreSQL: timestamps уже Date,
// date-only — строка (pg-date.test.ts).
const storedRow = {
  id: '00000000-0000-4000-8000-0000000000aa',
  ownerId: '00000000-0000-4000-8000-0000000000bb',
  title: 'Books',
  description: 'Art',
  occasionDate: '2028-02-29',
  visibility: 'public',
  createdAt: new Date('2026-10-12T12:00:00Z'),
  updatedAt: new Date('2026-10-12T12:30:00Z'),
} as const;

const decodeRow = (row: unknown) =>
  Effect.result(Schema.decodeUnknownEffect(WishlistSchema)(row));

// Задача 1.4. Сохранённая Schema и response не читают Clock и не исправляют
// значения: decode только проверяет строку, encode только меняет форму.
describe('Wishlist row and response schemas', () => {
  it.effect('Ответ create соответствует записи', () =>
    Effect.gen(function* () {
      // Строка БД → Wishlist.
      const wishlist = yield* Schema.decodeEffect(WishlistSchema)(storedRow);

      // Wishlist → JSON ответа: Date кодируется строкой ISO 8601.
      const json = yield* Schema.encodeEffect(WishlistResponseSchema)(wishlist);

      expect(json).toEqual({
        id: storedRow.id,
        ownerId: storedRow.ownerId,
        title: 'Books',
        description: 'Art',
        occasionDate: '2028-02-29',
        visibility: 'public',
        createdAt: '2026-10-12T12:00:00.000Z',
        updatedAt: '2026-10-12T12:30:00.000Z',
      });
    }),
  );

  it.effect('Чтение старой Occasion Date', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const row = { ...storedRow, occasionDate: '2020-02-29' };

      const result = yield* decodeRow(row);

      expect(
        Result.map(result, (wishlist) => wishlist.occasionDate),
      ).toBeResultSuccess('2020-02-29');
    }),
  );

  it.effect('Повреждённая строка при read', () =>
    Effect.gen(function* () {
      expect(
        yield* decodeRow({ ...storedRow, title: ' ' }),
      ).toBeResultSchemaFailure([expect.objectContaining({ path: ['title'] })]);
    }),
  );
});
