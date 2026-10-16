import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';

import { AppApi } from '#infra/api/api.js';
import { makeTechnicalFailureHandler } from '#infra/errors/technical-failure.js';
import { CurrentSession } from '#modules/auth/api/session-authentication.js';
import { wishlistsGroupIdentifier } from '#modules/wishlists/api/wishlists.api.constants.js';
import { WishlistsOperations } from '#modules/wishlists/schemas/wishlists-operations.schema.js';
import { WishlistsService } from '#modules/wishlists/service/wishlists.service.js';

const makeTechnicalErrorHandler = makeTechnicalFailureHandler({
  module: wishlistsGroupIdentifier,
  operations: WishlistsOperations,
});

export const WishlistsHandlersLive = HttpApiBuilder.group(
  AppApi,
  wishlistsGroupIdentifier,
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* WishlistsService;

      return handlers
        .handle(WishlistsOperations.create, ({ payload }) =>
          Effect.gen(function* () {
            const { user } = yield* CurrentSession;

            return yield* service.create(user.id, payload).pipe(
              Effect.catchTag(
                'OperationFailed',
                makeTechnicalErrorHandler({
                  operation: WishlistsOperations.create,
                }),
              ),
            );
          }),
        )
        .handle(WishlistsOperations.getReadableById, ({ params: { id } }) =>
          Effect.gen(function* () {
            const { user } = yield* CurrentSession;

            return yield* service.getReadableById(user.id, id).pipe(
              Effect.catchTag(
                'OperationFailed',
                makeTechnicalErrorHandler({
                  operation: WishlistsOperations.getReadableById,
                  meta: { targetWishlistId: id },
                }),
              ),
            );
          }),
        );
    }),
);
