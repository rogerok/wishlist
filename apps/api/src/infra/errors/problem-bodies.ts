import { Schema } from 'effect';

// Тексты, постоянные для типа проблемы (RFC 9457): одинаковы во всех её случаях.
export type ProblemTexts = {
  readonly code: string;
  readonly detail: string;
  readonly title: string;
  readonly type: string;
};

// Общая основа: постоянные поля из текстов и статуса + поля конкретного случая.
// const сохраняет литеральные типы текстов: code остаётся 'USER_NOT_FOUND', а не string.
const makeProblemBody =
  <const Status extends number>(status: Status) =>
  <const Texts extends ProblemTexts, Fields extends Schema.Struct.Fields>(
    texts: Texts,
    fields: Fields,
  ) =>
    Schema.Struct({
      code: Schema.tag(texts.code),
      detail: Schema.tag(texts.detail),
      status: Schema.tag(status),
      title: Schema.tag(texts.title),
      type: Schema.tag(texts.type),
      ...fields,
    });

const makeNotFound = makeProblemBody(404);
const makeConflict = makeProblemBody(409);

// Не найдено: id ресурса и instance — URI этого случая.
export const makeNotFoundBody = <
  const Texts extends ProblemTexts,
  Id extends Schema.Top,
  Instance extends Schema.Top,
>(
  texts: Texts,
  fields: { readonly id: Id; readonly instance: Instance },
) => makeNotFound(texts, fields);

// Конфликт с текущим состоянием (уникальность, повторная бронь): instance — URI случая.
export const makeConflictBody = <
  const Texts extends ProblemTexts,
  Instance extends Schema.Top,
>(
  texts: Texts,
  fields: { readonly instance: Instance },
) => makeConflict(texts, fields);
