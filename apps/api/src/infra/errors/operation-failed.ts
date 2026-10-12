import { Data } from 'effect';

export type FailureReason = 'dataIntegrity' | 'internal' | 'unavailable';

// Технический отказ. reason назначает тот, кто первым увидел отказ и знает его
// смысл; вызывающий код пропускает ошибку без переупаковки. source различает
// одинаковые имена операций разных источников (create есть у нескольких
// репозиториев) и вместе с operation попадает в errorChain лога.
export class OperationFailed extends Data.TaggedError('OperationFailed')<{
  readonly cause: unknown;
  readonly operation: string;
  readonly reason: FailureReason;
  readonly source: string;
}> {}
