import { describe, expect, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import * as TestClock from 'effect/testing/TestClock';

import { CreateWishlistBodySchema } from '#modules/wishlists/schemas/create-wishlist.schema.js';

// Окно при этом времени: 2026-10-11 … 2031-10-12 включительно.
const now = Date.parse('2026-10-12T12:00:00Z');
const windowMessage = 'Expected a date between 2026-10-11 and 2031-10-12';

const minimalBody = {
  title: 'Books',
  description: null,
  occasionDate: null,
  visibility: 'private',
} as const;

// Тело отличается от минимального одним полем. Окно Occasion Date читает Clock,
// поэтому decode идёт под TestClock.
const decodeWith = (field: Readonly<Record<string, unknown>>) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);

    return yield* Effect.result(
      Schema.decodeUnknownEffect(CreateWishlistBodySchema)({
        ...minimalBody,
        ...field,
      }),
    );
  });

const acceptedCases = [
  {
    name: 'Границы title после trim: 1 символ',
    field: { title: '  a  ' },
    expected: { title: 'a' },
  },
  {
    name: 'Границы title после trim: 255 символов',
    field: { title: `  ${'a'.repeat(255)}  ` },
    expected: { title: 'a'.repeat(255) },
  },
  {
    name: 'Пустое description: null',
    field: { description: null },
    expected: { description: null },
  },
  {
    name: 'Пустое description: пустая строка',
    field: { description: '' },
    expected: { description: null },
  },
  {
    name: 'Пустое description: только пробелы',
    field: { description: '   ' },
    expected: { description: null },
  },
  {
    name: 'Непустое description: 1 символ',
    field: { description: '  a  ' },
    expected: { description: 'a' },
  },
  {
    name: 'Непустое description: 1000 символов',
    field: { description: `  ${'a'.repeat(1000)}  ` },
    expected: { description: 'a'.repeat(1000) },
  },
  {
    name: 'Високосная дата',
    field: { occasionDate: '2028-02-29' },
    expected: { occasionDate: '2028-02-29' },
  },
  {
    name: 'Дата не указана',
    field: { occasionDate: null },
    expected: { occasionDate: null },
  },
  {
    name: 'Вчера принимается',
    field: { occasionDate: '2026-10-11' },
    expected: { occasionDate: '2026-10-11' },
  },
  {
    name: 'Пять лет принимаются',
    field: { occasionDate: '2031-10-12' },
    expected: { occasionDate: '2031-10-12' },
  },
  {
    name: 'Явная visibility',
    field: { visibility: 'public' },
    expected: { visibility: 'public' },
  },
  {
    name: 'Visibility private',
    field: { visibility: 'private' },
    expected: { visibility: 'private' },
  },
] as const;

const outsideWindowCases = [
  { name: 'Вчера минус один день отклоняется', occasionDate: '2026-10-10' },
  { name: 'Пять лет плюс один день отклоняются', occasionDate: '2031-10-13' },
] as const;

describe('CreateWishlistBodySchema', () => {
  it.effect.each(acceptedCases)('$name', ({ field, expected }) =>
    Effect.gen(function* () {
      expect(yield* decodeWith(field)).toBeResultSuccess({
        ...minimalBody,
        ...expected,
      });
    }),
  );

  it.effect.each(outsideWindowCases)('$name', ({ occasionDate }) =>
    Effect.gen(function* () {
      expect(yield* decodeWith({ occasionDate })).toBeResultSchemaFailure([
        expect.objectContaining({
          path: ['occasionDate'],
          message: windowMessage,
        }),
      ]);
    }),
  );

  // TODO(you): задача 1.3.
  it.todo('Невалидное поле');
  it.todo('Клиент передаёт серверные поля');
});
