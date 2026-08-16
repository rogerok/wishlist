import { HttpApi } from 'effect/unstable/httpapi';

import { healthGroup } from '#modules/health/health.route.js';
import { usersGroup } from '#modules/users/api/users.api.js';

export const AppApi = HttpApi.make('app').add(healthGroup).add(usersGroup);
