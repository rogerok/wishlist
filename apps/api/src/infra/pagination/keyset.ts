// Keyset-пагинация: следующая страница начинается строго после последней показанной строки. Для сортировки
// «новые сверху» модуль превращает запрос репозитория во вторую страницу так:
//
//   SELECT id, created_at FROM wishlists
//   WHERE owner_id = $1                                       -- WHERE репозитория остаётся
//     AND (created_at, id) < ($2::timestamptz, $3::uuid)       -- строго после строки из курсора
//   ORDER BY created_at DESC, id DESC
//   LIMIT 3                                                   -- limit 2 + 1: есть ли следующая страница
//
// `(a, b) < (x, y)` PostgreSQL сравнивает как слова в словаре: сначала `a` с `x`, при равенстве `b` с `y`. Каждый
// элемент такой пары описывает один `keyPart`. `id` стоит последним: у двух строк бывает одно время, но не один id.

import type { Array } from 'effect';
import type { SelectQueryBuilder } from 'kysely';

import { Effect } from 'effect';
import {
  type Expression,
  expressionBuilder,
  type ExpressionBuilder,
  sql,
  type SqlBool,
} from 'kysely';

// Метку ставит только `keyPart`. Символ не экспортируется, поэтому объект, написанный вручную, за `KeyPart` не сойдёт.
const keyPartTag = Symbol('KeyPart');
// Какие SQL-типы модуль умеет подставить в `cast($n as …)` и какой тип у значения в JS. Новый тип добавь сюда.
type KeyCastTypes = { date: string; timestamptz: Date; uuid: string };
type KeyCastType = keyof KeyCastTypes;

// Параметры вычисляемого ключа для шага 3б. Пресет `occasionDate` объявит `{ asOf: 'date' }`. Тогда в JS
// `ParamValues` даст `{ asOf: '2026-10-18' }`, а `rule` получит `ParamExpression`: `{ asOf: cast($n as date) }`.
type ParamSpec = Record<string, KeyCastType>;
type ParamValues<Spec extends ParamSpec> = {
  [K in keyof Spec]: KeyCastTypes[Spec[K]];
};
type ParamExpression<Spec extends ParamSpec> = {
  [K in keyof Spec]: Expression<KeyCastTypes[Spec[K]]>;
};

/** Один элемент пары `(created_at, id)`: его левая и правая сторона в WHERE. Создаётся только через `keyPart`. */
export type KeyPart<DB, TB extends keyof DB, Cursor> = {
  readonly [keyPartTag]: true;
  /** Левая сторона: значение из строки таблицы, например `created_at`. Её же модуль ставит в ORDER BY. */
  left: (eb: ExpressionBuilder<DB, TB>) => Expression<unknown>;
  /** Правая сторона: значение из курсора, например `cast($2 as timestamptz)`. */
  right: (eb: ExpressionBuilder<DB, TB>, cursor: Cursor) => Expression<unknown>;
};

/**
 * Элемент ключа, вычисленный по формуле `rule`. Пример: Wishlist с датой идут раньше Wishlist без даты.
 *
 * ```ts
 * rule: (date) => sql<number>`CASE WHEN ${date} IS NULL THEN 1 ELSE 0 END`
 * ```
 *
 * `keyPart` применяет одну формулу к обеим сторонам: слева к `occasion_date`, справа к `cast($n as date)` из курсора.
 * В WHERE сравниваются числа 0 и 1, а не даты, и NULL в сравнение не попадает. Колонка может быть NULL, а результат
 * `rule` не может: `rule: (date) => date` не скомпилируется.
 */
export function keyPart<
  DB,
  TB extends keyof DB,
  Cursor,
  S extends KeyCastType,
  R extends NonNullable<unknown>,
>(part: {
  sqlType: S;
  column: (eb: ExpressionBuilder<DB, TB>) => Expression<KeyCastTypes[S] | null>;
  rule: (input: Expression<KeyCastTypes[S] | null>) => Expression<R>;
  value: (cursor: Cursor) => KeyCastTypes[S] | null;
}): KeyPart<DB, TB, Cursor>;

/**
 * Элемент ключа из колонки. Пример для `created_at`:
 *
 * ```ts
 * keyPart({ sqlType: 'timestamptz', column: (eb) => eb.ref('createdAt'), value: (cursor) => cursor.createdAt })
 * ```
 *
 * - `column`: левая сторона, колонка `created_at`;
 * - `value`: что взять из курсора, например `10:00:03` последней показанной строки;
 * - `sqlType`: к какому типу привести это значение, `cast($2 as timestamptz)`. Без приведения PostgreSQL не всегда
 *   понимает тип параметра.
 *
 * `sqlType` задаёт тип для `column` и `value`: при `'timestamptz'` обе стороны обязаны быть `Date`. Поэтому пара
 * `createdAt` и `cursor.id` не скомпилируется. Колонка с NULL (`occasionDate`) здесь тоже не скомпилируется: NULL в
 * паре ломает сравнение, и PostgreSQL молча выбрасывает строку. Для такой колонки нужен `rule`.
 */
export function keyPart<
  DB,
  TB extends keyof DB,
  Cursor,
  S extends KeyCastType,
>(part: {
  sqlType: S;
  column: (eb: ExpressionBuilder<DB, TB>) => Expression<KeyCastTypes[S]>;
  value: (cursor: Cursor) => KeyCastTypes[S];
}): KeyPart<DB, TB, Cursor>;

// Тело общее для обеих перегрузок. Типы здесь `unknown`, а проверяют их перегрузки выше: снаружи эта сигнатура не
// видна. Без `rule` формула возвращает колонку как есть.
export function keyPart<DB, TB extends keyof DB, Cursor>(part: {
  sqlType: KeyCastType;
  column: (eb: ExpressionBuilder<DB, TB>) => Expression<unknown>;
  rule?: (input: Expression<unknown>) => Expression<unknown>;
  value: (cursor: Cursor) => unknown;
}): KeyPart<DB, TB, Cursor> {
  const rule = part.rule ?? ((input) => input);

  return {
    [keyPartTag]: true,
    left: (eb) => rule(part.column(eb)),
    right: (eb, cursor) =>
      rule(eb.cast(eb.val(part.value(cursor)), part.sqlType)),
  };
}

/**
 * Пресет сортировки, например «новые сверху» (ADR-0008, design, решение 4).
 *
 * Чтобы обход не терял и не повторял строки, нужны четыре условия:
 *
 * 1. слева и справа в WHERE одинаковые элементы в одном порядке;
 * 2. у `column` и `value` одного элемента один SQL-тип;
 * 3. ни один элемент пары не равен NULL: сравнение с NULL даёт «неизвестно», и WHERE выбрасывает строку;
 * 4. пара уникальна для каждой строки, поэтому последним идёт `id`.
 *
 * Условие 1 модуль обеспечивает сам: обе стороны строятся из одного списка `key`. Условие 2 и колонку с NULL
 * проверяет `check-types` через `keyPart`. Остальное ловят только тесты обхода на PostgreSQL: пару `title` и
 * `cursor.id` (обе `string`), NULL из ``sql<number>`…` `` и ключ без `id`.
 *
 * @typeParam DB - схема БД.
 * @typeParam TB - таблица запроса.
 * @typeParam Row - строка, которую выбирает репозиторий.
 * @typeParam Cursor - что курсор помнит о последней показанной строке, например `{ createdAt, id }`.
 */
export interface KeysetSort<DB, TB extends keyof DB, Row, Cursor> {
  /** Одно на весь ключ: `(a, b) < (x, y)` совпадает с ORDER BY, только если `a` и `b` идут в одну сторону. */
  direction: 'asc' | 'desc';
  /** Элементы пары в порядке сортировки, последний `id`. `key: []` не скомпилируется. */
  key: Array.NonEmptyReadonlyArray<KeyPart<DB, TB, Cursor>>;
  /** Что запомнить о последней строке страницы, чтобы следующая страница началась строго после неё. */
  cursorOf: (row: Row) => Cursor;
}

/**
 * Режет ответ базы на страницу. При `limit = 2` запрос вернул до 3 строк: клиент получает первые 2 и курсор по
 * второй. Третья строка нужна только как признак: если её нет, следующей страницы нет, и `nextCursor` равен `null`.
 */
const toPage = <DB, TB extends keyof DB, Row, Cursor>(
  sort: KeysetSort<DB, TB, Row, Cursor>,
  limit: number,
  rows: ReadonlyArray<Row>,
) => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined ? sort.cursorOf(last) : null,
  };
};

/**
 * Достраивает запрос репозитория до SQL из комментария в начале файла. Свои ORDER BY, LIMIT и OFFSET репозитория
 * модуль заменяет, а его WHERE (`owner_id = …`) оставляет. На первой странице курсора нет, и условия «после курсора»
 * тоже нет. Запрос здесь не выполняется: функция встраивается в цепочку Kysely через `$call`.
 */
const applyKeyset =
  <DB, TB extends keyof DB, Row, Cursor>(
    sort: KeysetSort<DB, TB, Row, Cursor>,
    page: { readonly cursor: Cursor | undefined; readonly limit: number },
  ) =>
  <O>(query: SelectQueryBuilder<DB, TB, O>): SelectQueryBuilder<DB, TB, O> => {
    const eb = expressionBuilder(query);

    let result = query.clearOrderBy().clearOffset().clearLimit();
    const key = sort.key.map((part) => part.left(eb));
    key.forEach((k) => {
      result = result.orderBy(k, sort.direction);
    });
    const sign = sort.direction === 'desc' ? '<' : '>';

    if (page.cursor !== undefined) {
      const cursor = page.cursor;
      const cursorValues = sort.key.map((part) => part.right(eb, cursor));

      result = result.where(
        sql<SqlBool>`(${sql.join(key)}) ${sql.raw(sign)} (${sql.join(cursorValues)})`,
      );
    }

    return result.limit(page.limit + 1);
  };

/**
 * Готовит одну страницу. Репозиторий вызывает так:
 *
 * ```ts
 * const keyset = yield* prepareKeyset(sort, { cursor, limit });
 * const rows = yield* db.selectFrom('wishlists').where(...).$call(keyset.apply);
 * return keyset.toPage(rows);
 * ```
 *
 * `limit` передаётся один раз, и `apply` с `toPage` не могут получить разные значения. `Effect` нужен для шага 3б:
 * на первой странице здесь появится вычисление `asOf`, сегодняшней даты.
 */
export const prepareKeyset = <DB, TB extends keyof DB, Row, Cursor>(
  sort: KeysetSort<DB, TB, Row, Cursor>,
  page: { readonly cursor: Cursor | undefined; readonly limit: number },
) =>
  Effect.gen(function* () {
    const apply = applyKeyset(sort, page);

    return {
      apply,
      toPage: (rows: ReadonlyArray<Row>) => toPage(sort, page.limit, rows),
    };
  });
