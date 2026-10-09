import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

describe('Option matchers', () => {
  it('matches selected fields inside Some', () => {
    const option = Option.some({ id: 42, email: 'user@example.test' });

    expect(option).toBeOptionSome({ id: 42 });
    expect(option).not.toBeOptionSome({ id: 43 });
    expect(() => expect(option).toBeOptionSome({ id: 43 })).toThrow();
    expect(() => expect(option).toBeOptionNone()).toThrow();
  });

  it('distinguishes None from Some and non-Option values', () => {
    const none = Option.none<{ id: number }>();

    expect(none).toBeOptionNone();
    expect(() => expect(none).toBeOptionSome({ id: 42 })).toThrow();
    expect(() => expect({ _tag: 'None' }).toBeOptionNone()).toThrow();
  });
});
