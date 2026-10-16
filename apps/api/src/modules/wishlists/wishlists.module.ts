import { Layer } from 'effect';

import { WishlistRepositoryLive } from './repository/wishlists.repository.js';
import { WishlistsServiceLive } from './service/wishlists.service.js';

export const WishlistsModuleLive = WishlistsServiceLive.pipe(
  Layer.provide(WishlistRepositoryLive),
);
