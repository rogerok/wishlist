import { randomBytes } from 'crypto';

const buf = Buffer.from(Array.from({ length: 32 }));

const secureRandomBytes = () => buf;
