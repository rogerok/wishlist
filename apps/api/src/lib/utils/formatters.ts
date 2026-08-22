export const makePath = <
  const Base extends string,
  const Segment extends string,
>(
  base: Base,
  segment: Segment,
): `${Base}/${Segment}` => `${base}/${segment}`;
