export interface AuthContext {
  userId: string;
  tier: string;
}

export interface OptionalAuthContext {
  userId: string | null;
  tier: string | null;
}
