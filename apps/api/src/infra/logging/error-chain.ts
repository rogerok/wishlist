import { Predicate } from 'effect';

export type ErrorLink = {
  readonly tag: string;
  readonly operation?: string;
};

const maxChainDepth = 10;

// Звено — объект со строковым _tag. Всё остальное обрывает цепочку,
// поэтому ошибки драйвера и обычные значения в лог не попадают.
const isTaggedValue = (value: unknown): value is { readonly _tag: string } =>
  Predicate.hasProperty(value, '_tag') && Predicate.isString(value._tag);

// Копируем только поля, описывающие отказ: ни message, ни данные записи.
const toLink = (value: { readonly _tag: string }): ErrorLink =>
  Predicate.hasProperty(value, 'operation') &&
  Predicate.isString(value.operation)
    ? { tag: value._tag, operation: value.operation }
    : { tag: value._tag };

export const describeErrorChain = (
  error: unknown,
): ReadonlyArray<ErrorLink> => {
  const links: Array<ErrorLink> = [];
  let current: unknown = error;

  while (isTaggedValue(current) && links.length < maxChainDepth) {
    links.push(toLink(current));
    current = Predicate.hasProperty(current, 'cause')
      ? current.cause
      : undefined;
  }

  return links;
};
