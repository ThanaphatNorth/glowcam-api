import type { AuthContext, OptionalAuthContext } from './auth';

export type AppEnv = {
  Variables: {
    auth: AuthContext;
    optionalAuth: OptionalAuthContext;
    requestId: string;
  };
};
