import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  tier: string;
  iat: number;
  exp: number;
}

const JWT_ALGORITHM = 'HS256' as const;
const ACCESS_TOKEN_EXPIRY = '15m';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set.');
  return new TextEncoder().encode(secret);
}

export async function generateAccessToken(userId: string, tier: string): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT({ sub: userId, tier })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('glowcam')
    .setAudience('glowcam:user')
    .sign(secret);
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = getSecretKey();
  const { payload } = await jwtVerify(token, secret, {
    issuer: 'glowcam',
    audience: 'glowcam:user',
    algorithms: [JWT_ALGORITHM],
  });
  if (!payload.sub || !payload.exp || !payload.iat) {
    throw new Error('Invalid token payload: missing required fields');
  }
  return { sub: payload.sub, tier: payload.tier as string, iat: payload.iat, exp: payload.exp };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
