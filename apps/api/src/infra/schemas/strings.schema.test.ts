import { Schema } from 'effect';

import {
  makeOptionalTextSchemas,
  makeTrimmedTextSchemas,
} from '#infra/schemas/strings.schema.js';

const text = makeOptionalTextSchemas({ min: 2, max: 5 });
const InputBody = Schema.Struct({ text: text.input });

const normalizedInputCases = [
  { name: 'null', body: { text: null }, expected: null },
  { name: 'an empty string', body: { text: '' }, expected: null },
  { name: 'only spaces', body: { text: '   ' }, expected: null },
  { name: 'surrounding spaces', body: { text: '  Art  ' }, expected: 'Art' },
  {
    name: 'the maximum length after trim',
    body: { text: '  abcde  ' },
    expected: 'abcde',
  },
] as const;

const rejectedInputCases = [
  { name: 'a missing key', body: {} },
  { name: 'a number', body: { text: 42 } },
  { name: 'less than the minimum after trim', body: { text: ' a ' } },
  { name: 'more than the maximum after trim', body: { text: ' abcdef ' } },
] as const;

const rejectedStoredCases = [
  { name: 'an empty string', value: '' },
  { name: 'less than the minimum', value: 'a' },
  { name: 'only spaces', value: '   ' },
  { name: 'surrounding spaces', value: ' Art ' },
  { name: 'more than the maximum', value: 'abcdef' },
] as const;

describe('optional text schemas', () => {
  it.each(normalizedInputCases)(
    'input normalizes $name',
    ({ body, expected }) => {
      const result = Schema.decodeResult(InputBody)(body);

      expect(result).toBeResultSuccess({ text: expected });
    },
  );

  it.each(rejectedInputCases)('input rejects $name', ({ body }) => {
    const result = Schema.decodeUnknownResult(InputBody)(body);

    expect(result).toBeResultSchemaFailure([
      expect.objectContaining({ path: ['text'] }),
    ]);
  });

  it('stored accepts null and trimmed text unchanged', () => {
    expect(Schema.decodeResult(text.stored)(null)).toBeResultSuccess(null);
    expect(Schema.decodeResult(text.stored)('Art')).toBeResultSuccess('Art');
  });

  it.each(rejectedStoredCases)('stored rejects $name', ({ value }) => {
    const result = Schema.decodeResult(text.stored)(value);

    expect(result).toBeResultSchemaFailure([expect.anything()]);
  });
});

const requiredText = makeTrimmedTextSchemas({ min: 2, max: 5 });

const trimmedInputCases = [
  { name: 'surrounding spaces', value: '  Art  ', expected: 'Art' },
  { name: 'the minimum length', value: 'ab', expected: 'ab' },
  {
    name: 'the maximum length after trim',
    value: ' abcde ',
    expected: 'abcde',
  },
] as const;

const rejectedRequiredInputCases = [
  { name: 'null', value: null },
  { name: 'only spaces', value: '   ' },
  { name: 'less than the minimum after trim', value: ' a ' },
  { name: 'more than the maximum after trim', value: ' abcdef ' },
] as const;

const rejectedRequiredStoredCases = [
  { name: 'only spaces', value: '   ' },
  { name: 'surrounding spaces', value: ' Art ' },
  { name: 'less than the minimum', value: 'a' },
  { name: 'more than the maximum', value: 'abcdef' },
] as const;

describe('required text schemas', () => {
  it.each(trimmedInputCases)('input trims $name', ({ value, expected }) => {
    const result = Schema.decodeResult(requiredText.input)(value);

    expect(result).toBeResultSuccess(expected);
  });

  it.each(rejectedRequiredInputCases)('input rejects $name', ({ value }) => {
    const result = Schema.decodeUnknownResult(requiredText.input)(value);

    expect(result).toBeResultSchemaFailure([expect.anything()]);
  });

  it('stored accepts trimmed text unchanged', () => {
    const result = Schema.decodeResult(requiredText.stored)('Art');

    expect(result).toBeResultSuccess('Art');
  });

  it.each(rejectedRequiredStoredCases)('stored rejects $name', ({ value }) => {
    const result = Schema.decodeResult(requiredText.stored)(value);

    expect(result).toBeResultSchemaFailure([expect.anything()]);
  });
});
