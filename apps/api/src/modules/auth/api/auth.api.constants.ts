import { makePath } from '#lib/utils/formatters.js';

export const authGroupIdentifier = 'auth';

export const authCollectionPath = '/api/auth';
export const authSignupPath = makePath(authCollectionPath, 'signup');
export const authLoginPath = makePath(authCollectionPath, 'login');
export const authLogoutPath = makePath(authCollectionPath, 'logout');
export const authMePath = makePath(authCollectionPath, 'me');
