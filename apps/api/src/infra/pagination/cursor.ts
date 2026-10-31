import { Schema } from 'effect';

export const makeCursorCodec = <S extends Schema.Top>(payload: S) =>
  Schema.StringFromBase64Url.pipe(
    Schema.decodeTo(Schema.fromJsonString(payload)),
  );
