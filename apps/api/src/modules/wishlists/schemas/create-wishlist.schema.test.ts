import { describe, expect, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import * as TestClock from 'effect/testing/TestClock';

import { requestParseOptions } from '#infra/api/request-parse-options.js';
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

// Задача 1.3: тот же разбор, что делает HttpApi для AppApi. С effect 4.0.4
// Schema сама лишний ключ не отклоняет, настройки передаются в decode явно.
const decodeStrict = (body: unknown) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);

    return yield* Effect.result(
      Schema.decodeUnknownEffect(
        CreateWishlistBodySchema,
        requestParseOptions,
      )(body),
    );
  });

const withoutField = (field: keyof typeof minimalBody) =>
  Object.fromEntries(
    Object.entries(minimalBody).filter(([key]) => key !== field),
  );

const withField = (field: keyof typeof minimalBody, value: unknown) => ({
  ...minimalBody,
  [field]: value,
});

const describeValue = (value: unknown) =>
  typeof value === 'string' && value.length > 30
    ? `строка из ${value.trim().length} символов после trim`
    : JSON.stringify(value);

// Матрица delta-spec «Невалидное поле»: меняется одно поле минимального тела.
const invalidValues = [
  ['title', [null, 42, '', '   ', ` ${'a'.repeat(256)} `]],
  ['description', [42, ` ${'a'.repeat(1001)} `]],
  [
    'occasionDate',
    [
      42,
      '2027-02-29',
      '2028-02-30',
      '2028-13-01',
      '2028-00-01',
      '2028-01-00',
      '2028-2-9',
      '0000-01-01',
      '2028-02-29T00:00:00Z',
    ],
  ],
  ['visibility', [null, 42, 'unlisted', 'PUBLIC']],
] as const satisfies ReadonlyArray<
  readonly [keyof typeof minimalBody, ReadonlyArray<unknown>]
>;

const missingFieldCases = invalidValues.map(([field]) => ({
  name: `${field} отсутствует`,
  field,
  body: withoutField(field),
}));

const wrongValueCases = invalidValues.flatMap(([field, values]) =>
  values.map((value) => ({
    name: `${field}: ${describeValue(value)}`,
    field,
    body: withField(field, value),
  })),
);

const invalidFieldCases = [...missingFieldCases, ...wrongValueCases];

const serverFieldCases = [
  {
    name: 'ownerId',
    extra: { ownerId: '00000000-0000-4000-8000-0000000000bb' },
  },
  { name: 'id', extra: { id: '00000000-0000-4000-8000-0000000000aa' } },
  { name: 'createdAt', extra: { createdAt: '2026-10-12T12:00:00Z' } },
  { name: 'updatedAt', extra: { updatedAt: '2026-10-12T12:00:00Z' } },
  { name: 'произвольное поле', extra: { color: 'red' } },
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

  // Задача 1.3. Ровно одна ошибка на поле: с errors: 'all' лишняя ошибка
  // в другом поле тоже попала бы в список и тест бы её заметил.
  it.effect.each(invalidFieldCases)(
    'Невалидное поле: $name',
    ({ body, field }) =>
      Effect.gen(function* () {
        expect(yield* decodeStrict(body)).toBeResultSchemaFailure([
          expect.objectContaining({ path: [field] }),
        ]);
      }),
  );

  it.effect.each(serverFieldCases)(
    'Клиент передаёт серверные поля: $name',
    ({ extra }) =>
      Effect.gen(function* () {
        // Ошибка лишнего ключа указывает на сам ключ.
        const expectedPath = Object.keys(extra);

        expect(
          yield* decodeStrict({ ...minimalBody, ...extra }),
        ).toBeResultSchemaFailure([
          expect.objectContaining({
            path: expectedPath,
            message: 'Expected no excess property',
          }),
        ]);
      }),
  );
});
