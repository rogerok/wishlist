import { DateTime, Option, Schema } from 'effect';

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
