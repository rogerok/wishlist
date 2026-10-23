import type { Array } from 'effect';
import type { SelectQueryBuilder } from 'kysely';

import {
  type Expression,
  expressionBuilder,
  type ExpressionBuilder,
  sql,
  type SqlBool,
} from 'kysely';

/**
 * Сортировка постраничного списка (ADR-0008, design, решение 4). Ключ задаётся дважды: над колонками строки
 * (`keyColumns`) и над значениями курсора (`cursorValues`). Пресет обязан соблюдать контракт:
 *
 * 1. одинаковое число компонентов в обоих ключах и одинаковый их порядок;
 * 2. совместимые SQL-типы компонентов на одной позиции;
 * 3. ни один компонент итогового ключа не равен SQL NULL: сравнение кортежей с NULL даёт «неизвестно», и WHERE
 *    молча отбрасывает строку;
 * 4. полный ключ уникален среди строк результата; последний компонент — уникальный id.
 *
 * Пункты 1–2 проверяет компилятор через `Key`. Перестановку компонентов одного типа и пункты 3–4 ловит только обход
 * на PostgreSQL.
 *
 * @typeParam DB - схема БД запроса.
 * @typeParam TB - таблица запроса.
 * @typeParam Row - строка, которую выбрал пользователь модуля.
 * @typeParam Cursor - значения ключа последней показанной строки.
 * @typeParam Key - кортеж типов значений ключа, например `readonly [Date, string]`.
 */
export interface KeysetSort<
  DB,
  TB extends keyof DB,
  Row,
  Cursor,
  Key extends Array.NonEmptyReadonlyArray<unknown>,
> {
  /** Одно на весь ключ: сравнение кортежей совпадает с ORDER BY только при общем направлении. */
  direction: 'asc' | 'desc';
  /** Курсор по последней строке страницы: что запомнить, чтобы следующая страница началась строго после неё. */
  cursorOf: (row: Row) => Cursor;
  /** Значения ключа из курсора — правая часть сравнения в WHERE. */
  cursorValues: (cursor: Cursor) => Key;
  /** Выражения ключа над строкой — ORDER BY и левая часть сравнения в WHERE. */
  keyColumns: (eb: ExpressionBuilder<DB, TB>) => {
    readonly [K in keyof Key]: Expression<Key[K]>;
  };
}

/**
 * Собирает страницу из строк, которые вернул запрос после `applyKeyset`: первые `limit` строк и курсор по последней
 * из них. `nextCursor` равен `null`, только если лишней (`limit + 1`-й) строки нет.
 */
export const toPage = <
  DB,
  TB extends keyof DB,
  Row,
  Cursor,
  Key extends Array.NonEmptyReadonlyArray<unknown>,
>(
  sort: KeysetSort<DB, TB, Row, Cursor, Key>,
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
 * Достраивает запрос пользователя модуля: заменяет его ORDER BY, LIMIT и OFFSET своими, добавляет условие «строго
 * после курсора» и берёт `limit + 1` строк. WHERE пользователя — область видимости — сохраняется. Запрос не
 * выполняется; функция встраивается в цепочку через `$call`.
 */
export const applyKeyset =
  <
    DB,
    TB extends keyof DB,
    Row,
    Cursor,
    Key extends Array.NonEmptyReadonlyArray<unknown>,
  >(
    sort: KeysetSort<DB, TB, Row, Cursor, Key>,
    page: { readonly cursor: Cursor | undefined; readonly limit: number },
  ) =>
  <O>(query: SelectQueryBuilder<DB, TB, O>): SelectQueryBuilder<DB, TB, O> => {
    let result = query.clearOrderBy().clearOffset().clearLimit();
    const key = sort.keyColumns(expressionBuilder(query));
    key.forEach((k) => {
      result = result.orderBy(k, sort.direction);
    });
    const sign = sort.direction === 'desc' ? '<' : '>';

    if (page.cursor !== undefined) {
      const cursorValues = sort.cursorValues(page.cursor);

      result = result.where(
        sql<SqlBool>`(${sql.join(key)}) ${sql.raw(sign)} (${sql.join(cursorValues)})`,
      );
    }

    return result.limit(page.limit + 1);
  };
