export const isSafeIntegerInRange = (value: number, min: number, max: number) =>
  Number.isSafeInteger(value) &&
  Number.isSafeInteger(max) &&
  value >= min &&
  value <= max;
