import { Schema } from 'effect';

import {
  CalendarDate,
  isCalendarDate,
  PgCalendarDate,
  PgInstantFromString,
} from '#infra/schemas/dates.schema.js';

const calendarDates = [
  { name: 'a leap day', value: '2028-02-29' },
  { name: 'a leap day of a year divisible by 400', value: '2000-02-29' },
  { name: 'the first day of year 1', value: '0001-01-01' },
  { name: 'a year below 100', value: '0099-12-31' },
  { name: 'the last day of year 9999', value: '9999-12-31' },
] as const;

const notCalendarDates = [
  { name: 'a leap day of a common year', value: '2027-02-29' },
  { name: 'a leap day of a century year', value: '1900-02-29' },
  { name: 'February 30', value: '2028-02-30' },
  { name: 'April 31', value: '2028-04-31' },
  { name: 'month 13', value: '2028-13-01' },
  { name: 'month 0', value: '2028-00-01' },
  { name: 'day 0', value: '2028-01-00' },
  { name: 'a date without leading zeros', value: '2028-2-9' },
  { name: 'a date with time', value: '2028-02-29T00:00:00Z' },
  { name: 'a date with surrounding spaces', value: ' 2028-02-29 ' },
  { name: 'an empty string', value: '' },
  { name: 'arbitrary text', value: 'tomorrow' },
] as const;

describe('isCalendarDate', () => {
  it.each(calendarDates)('accepts $name', ({ value }) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(notCalendarDates)('rejects $name', ({ value }) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});

describe('CalendarDate', () => {
  it('decodes a calendar date unchanged', () => {
    const result = Schema.decodeResult(CalendarDate)('2028-02-29');

    expect(result).toBeResultSuccess('2028-02-29');
  });

  it('rejects a date that does not exist with a calendar message', () => {
    const result = Schema.decodeResult(CalendarDate)('2027-02-29');

    expect(result).toBeResultSchemaFailure([
      expect.objectContaining({
        message: 'Expected a calendar date YYYY-MM-DD',
      }),
    ]);
  });

  it('rejects a value that is not a string', () => {
    const result = Schema.decodeUnknownResult(CalendarDate)(20280229);

    expect(result).toBeResultSchemaFailure([expect.anything()]);
  });
});

describe('PgCalendarDate', () => {
  it.each(['0001-01-01', '2028-02-29', '9999-12-31'])('accepts %s', (value) => {
    expect(Schema.decodeResult(PgCalendarDate)(value)).toBeResultSuccess(value);
  });

  it('keeps the calendar message for a date that does not exist', () => {
    expect(
      Schema.decodeResult(PgCalendarDate)('2027-02-29'),
    ).toBeResultSchemaFailure([
      expect.objectContaining({
        message: 'Expected a calendar date YYYY-MM-DD',
      }),
    ]);
  });

  it('rejects year 0000, which PostgreSQL does not accept', () => {
    expect(
      Schema.decodeResult(PgCalendarDate)('0000-01-01'),
    ).toBeResultSchemaFailure([
      expect.objectContaining({
        message: 'Expected a date from 0001-01-01',
      }),
    ]);
  });
});

const instant = '2026-10-01T10:00:00.123Z';

const notPgInstants = [
  { name: 'a moment that does not exist', value: '2026-02-30T00:00:00.000Z' },
  { name: 'year 0000', value: '0000-01-01T00:00:00.000Z' },
  { name: 'a date without time', value: '2026-10-01' },
  { name: 'a moment without milliseconds', value: '2026-10-01T10:00:00Z' },
  { name: 'an offset other than Z', value: '2026-10-01T10:00:00.000+03:00' },
  { name: 'an expanded year', value: '+002026-10-01T00:00:00.000Z' },
] as const;

describe('PgInstantFromString', () => {
  it('decodes a UTC moment with milliseconds into a Date', () => {
    expect(Schema.decodeResult(PgInstantFromString)(instant)).toBeResultSuccess(
      new Date(instant),
    );
  });

  it('encodes a Date back into the same string', () => {
    expect(
      Schema.encodeResult(PgInstantFromString)(new Date(instant)),
    ).toBeResultSuccess(instant);
  });

  it.each(notPgInstants)('rejects $name', ({ value }) => {
    expect(
      Schema.decodeResult(PgInstantFromString)(value),
    ).toBeResultSchemaFailure([expect.anything()]);
  });
});
