import { HttpApi, HttpApiBuilder } from '@effect/platform';

import { usersGroup } from '#modules/users/users.route.js';

export const WishlistApi = HttpApi.make('wishlist').add(usersGroup);

export const WishlistApiLive = HttpApiBuilder.api(WishlistApi);
