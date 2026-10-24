import type { Array } from 'effect';
import type { SelectQueryBuilder } from 'kysely';

import {
  type Expression,
  expressionBuilder,
  type ExpressionBuilder,
  sql,
  type SqlBool,
} from 'kysely';

// Свойство с этим символом ставит только `keyPart`. Символ не экспортируется, и объект, написанный вручную, к `KeyPart`
// не подойдёт.
const keyPartTag = Symbol('KeyPart');

/** Колонка строки и значение курсора, которые WHERE сравнит друг с другом. Создай через `keyPart`. */
export type KeyPart<DB, TB extends keyof DB, Cursor> = {
  readonly [keyPartTag]: true;
  /** Левая часть сравнения и ORDER BY, например `eb.ref('createdAt')`. */
  column: (eb: ExpressionBuilder<DB, TB>) => Expression<unknown>;
  /** Правая часть сравнения, например `cursor.createdAt`. */
  value: (cursor: Cursor) => unknown;
};

/**
 * Проверяет, что `column` и `value` дают один тип `T`: пара `eb.ref('createdAt')` и `cursor.id` не скомпилируется.
 * `T` не может включать `null`, поэтому не пройдёт и `eb.ref('occasionDate')`. `DB`, `TB` и `Cursor` TypeScript
 * берёт из места вызова, например из поля `key` пресета.
 */
export const keyPart = <
  DB,
  TB extends keyof DB,
  Cursor,
  T extends NonNullable<unknown>,
>(part: {
  column: (eb: ExpressionBuilder<DB, TB>) => Expression<T>;
  value: (cursor: Cursor) => T;
}): KeyPart<DB, TB, Cursor> => ({
  ...part,
  [keyPartTag]: true,
});

/**
 * Сортировка постраничного списка (ADR-0008, design, решение 4). Пресет обязан соблюдать контракт:
 *
 * 1. обе стороны сравнения в WHERE содержат одинаковое число компонентов в одном порядке;
 * 2. у `column` и `value` одного компонента совместимые SQL-типы;
 * 3. ни один компонент итогового ключа не равен SQL NULL: сравнение кортежей с NULL даёт «неизвестно», и WHERE
 *    молча отбрасывает строку;
 * 4. полный ключ уникален среди строк результата, последний компонент: уникальный id.
 *
 * Пункт 1 соблюдается сам: `applyKeyset` строит обе стороны из одного списка `key`. Пункт 2 и колонку с NULL
 * проверяет `check-types` через `keyPart`. Остальное ловит только обход на PostgreSQL: пару `eb.ref('title')` и
 * `cursor.id` (обе `string`), NULL из ``sql<number>`…` `` и нарушение пункта 4.
 *
 * @typeParam DB - схема БД запроса.
 * @typeParam TB - таблица запроса.
 * @typeParam Row - строка, которую выбрал пользователь модуля.
 * @typeParam Cursor - значения ключа последней показанной строки.
 */
export interface KeysetSort<DB, TB extends keyof DB, Row, Cursor> {
  /** Одно на весь ключ: сравнение кортежей совпадает с ORDER BY только при общем направлении. */
  direction: 'asc' | 'desc';
  /** Компоненты в порядке сортировки, последний: id. `key: []` не скомпилируется. */
  key: Array.NonEmptyReadonlyArray<KeyPart<DB, TB, Cursor>>;
  /** Курсор по последней строке страницы: что запомнить, чтобы следующая страница началась строго после неё. */
  cursorOf: (row: Row) => Cursor;
}

/**
 * Собирает страницу из строк, которые вернул запрос после `applyKeyset`: первые `limit` строк и курсор по последней
 * из них. `nextCursor` равен `null`, только если лишней (`limit + 1`-й) строки нет.
 */
export const toPage = <DB, TB extends keyof DB, Row, Cursor>(
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
 * Достраивает запрос пользователя модуля: заменяет его ORDER BY, LIMIT и OFFSET своими, добавляет условие «строго
 * после курсора» и берёт `limit + 1` строк. WHERE пользователя — область видимости — сохраняется. Запрос не
 * выполняется; функция встраивается в цепочку через `$call`.
 */
export const applyKeyset =
  <DB, TB extends keyof DB, Row, Cursor>(
    sort: KeysetSort<DB, TB, Row, Cursor>,
    page: { readonly cursor: Cursor | undefined; readonly limit: number },
  ) =>
  <O>(query: SelectQueryBuilder<DB, TB, O>): SelectQueryBuilder<DB, TB, O> => {
    const eb = expressionBuilder(query);

    let result = query.clearOrderBy().clearOffset().clearLimit();
    const key = sort.key.map((part) => part.column(eb));
    key.forEach((k) => {
      result = result.orderBy(k, sort.direction);
    });
    const sign = sort.direction === 'desc' ? '<' : '>';

    if (page.cursor !== undefined) {
      const cursor = page.cursor;
      const cursorValues = sort.key.map((part) => part.value(cursor));

      result = result.where(
        sql<SqlBool>`(${sql.join(key)}) ${sql.raw(sign)} (${sql.join(cursorValues)})`,
      );
    }

    return result.limit(page.limit + 1);
  };
