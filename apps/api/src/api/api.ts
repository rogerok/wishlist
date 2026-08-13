import { HttpApi } from 'effect/unstable/httpapi';

import { healthGroup } from '#modules/health/health.route.js';
import { usersGroup } from '#modules/users/users.route.js';

export const AppApi = HttpApi.make('app').add(healthGroup).add(usersGroup);
