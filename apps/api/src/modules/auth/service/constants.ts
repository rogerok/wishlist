export const saltBytesLength = 16;
export const derivedKeyBytesLength = 32;
export const tokenBytesLength = 32;
export const saltTextLength = 22;
export const derivedKeyTextLength = 43;
export const tokenTextLength = 43;
export const segmentsLength = 6;
export const cryptVersion = 1;
export const cryptAlgorithm = 'scrypt';

export const cryptOptions = {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
} as const;

export const base64UrlRegex = /^[A-Za-z0-9_-]+$/;

export const secureRandomBytesMaxLength = 128;
export const secureRandomBytesMinLength = 1;

export const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
