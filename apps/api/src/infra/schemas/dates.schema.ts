import { DateTime, Option, Schema } from 'effect';

const MIN_YEAR = 1;

export const isCalendarDate = (value: string): boolean =>
  Option.exists(
    DateTime.make(value),
    (date) => DateTime.formatIsoDateUtc(date) === value,
  );

export const CalendarDate = Schema.String.check(
  Schema.makeFilter(
    (value) => isCalendarDate(value) || 'Expected a calendar date YYYY-MM-DD',
  ),
);

const isDateYearGreaterOrEqualThan = (date: DateTime.Utc, year: number) =>
  DateTime.getPartUtc(date, 'year') >= year;

export const isPgCalendarDate = (value: string): boolean =>
  Option.exists(DateTime.make(value), (date) =>
    isDateYearGreaterOrEqualThan(date, MIN_YEAR),
  );
export const PgCalendarDate = CalendarDate.check(
  Schema.makeFilter(
    (value) => isPgCalendarDate(value) || 'Expected a date from 0001-01-01',
  ),
);

export const PgInstantFromString = Schema.String.check(
  Schema.makeFilter((value) =>
    Option.exists(
      DateTime.make(value),
      (date) =>
        isDateYearGreaterOrEqualThan(date, MIN_YEAR) &&
        DateTime.formatIso(date) === value,
    ),
  ),
).pipe(Schema.decodeTo(Schema.DateFromString));
