import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#api/api.js';
import { UsersService } from '#modules/users/users.service.js';

export const UsersApiLive = HttpApiBuilder.group(AppApi, 'users', (handlers) =>
  handlers.handle('getById', ({ params }) =>
    UsersService.use((service) => service.getById(params.id)),
  ),
);
