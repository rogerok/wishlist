import { Schema } from 'effect';

import { CalendarDate, isCalendarDate } from '#infra/schemas/dates.schema.js';

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
    const result = Schema.decodeUnknownResult(CalendarDate)('2028-02-29');

    expect(result).toBeResultSuccess('2028-02-29');
  });

  it('rejects a date that does not exist with a calendar message', () => {
    const result = Schema.decodeUnknownResult(CalendarDate)('2027-02-29');

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
