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

// Свойство с этим символом ставит только `keyPart`. Символ не экспортируется, и объект, написанный вручную, к `KeyPart`
// не подойдёт.
const keyPartTag = Symbol('KeyPart');
// SQL-тип, к которому модуль приводит значение курсора, и тип этого значения в JS. Новый тип добавляется строкой здесь
type KeyCastTypes = { date: string; timestamptz: Date; uuid: string };
type KeyCastType = keyof KeyCastTypes;

type ParamSpec = Record<string, KeyCastType>;
type ParamValues<Spec extends ParamSpec> = {
  [K in keyof Spec]: KeyCastTypes[Spec[K]];
};
type ParamExpression<Spec extends ParamSpec> = {
  [K in keyof Spec]: Expression<KeyCastTypes[Spec[K]]>;
};

/** Обе стороны сравнения для одного компонента ключа. Создай через `keyPart`. */
export type KeyPart<DB, TB extends keyof DB, Cursor> = {
  readonly [keyPartTag]: true;
  /** Левая сторона сравнения и ORDER BY, например `"created_at"`. */
  left: (eb: ExpressionBuilder<DB, TB>) => Expression<unknown>;
  /** Правая сторона сравнения из значения курсора, например `cast($1 as timestamptz)`. */
  right: (eb: ExpressionBuilder<DB, TB>, cursor: Cursor) => Expression<unknown>;
};

/**
 * Компонент ключа из колонки строки и значения курсора. `keyPart` строит обе стороны сравнения одинаково: левую как
 * `rule(column)`, правую как `rule(cast($n as sqlType))`, поэтому стороны не могут разойтись
 *
 * Эта перегрузка без `rule`, для колонок без NULL (`createdAt`, `id`). TypeScript выводит `S` из `sqlType` и требует
 * от `column` и `value` тип `KeyCastTypes[S]`. Не скомпилируются `sqlType: 'date'` рядом с `eb.ref('createdAt')`
 * (`Date`), пара `eb.ref('createdAt')` с `cursor.id` и колонка `eb.ref('occasionDate')`: в `KeyCastTypes` нет `null`.
 * `DB`, `TB` и `Cursor` TypeScript берёт из места вызова, например из поля `key` пресета.
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

/**
 * Перегрузка с `rule`, для вычисляемого ключа (`occasionDate`). Колонка и значение курсора могут быть NULL, а
 * результат `rule` нет: `rule: (d) => d` для `eb.ref('occasionDate')` не скомпилируется. `rule` получает колонку для
 * левой стороны и `cast($n as sqlType)` для правой.
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

// Реализацию снаружи не видно: вызвать `keyPart` можно только через перегрузки выше, и типы проверяют они. Здесь типы
// `unknown`, а без `rule` компонентом служит сама колонка.
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
 * Сортировка постраничного списка (ADR-0008, design, решение 4). Пресет обязан соблюдать контракт:
 *
 * 1. обе стороны сравнения в WHERE содержат одинаковое число компонентов в одном порядке;
 * 2. у `column` и `value` одного компонента совместимые SQL-типы;
 * 3. ни один компонент итогового ключа не равен SQL NULL: сравнение кортежей с NULL даёт «неизвестно», и WHERE
 *    молча отбрасывает строку;
 * 4. полный ключ уникален среди строк результата, последний компонент: уникальный id.
 *
 * Пункт 1 соблюдается сам: `applyKeyset` берёт обе стороны из одного списка `key`, а `keyPart` строит стороны
 * компонента из одного правила. Пункт 2 и колонку с NULL проверяет `check-types` через `keyPart`. Остальное ловит
 * только обход на PostgreSQL: пару `eb.ref('title')` и `cursor.id` (обе `string`), NULL из ``sql<number>`…` `` и
 * нарушение пункта 4.
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
 * Достраивает запрос пользователя модуля: заменяет его ORDER BY, LIMIT и OFFSET своими, добавляет условие «строго
 * после курсора» и берёт `limit + 1` строк. WHERE пользователя — область видимости — сохраняется. Запрос не
 * выполняется; функция встраивается в цепочку через `$call`.
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
