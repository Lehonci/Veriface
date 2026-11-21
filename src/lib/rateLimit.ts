import { NextRequest } from 'next/server';

interface RateLimitBucket {
  timestamps: number[];
}

const g = globalThis as unknown as {
  __verifaceRateLimitStore?: Map<string, RateLimitBucket>;
};

const rateLimitStore = g.__verifaceRateLimitStore || new Map<string, RateLimitBucket>();
g.__verifaceRateLimitStore = rateLimitStore;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Mengambil alamat IP klien secara konsisten dari header proxy maupun request langsung.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || '127.0.0.1';
}

/**
 * Sliding-window rate limiter in-memory untuk membatasi brute force & flooding endpoint.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Pembersihan berkala agar Map tidak tumbuh tanpa batas
  if (rateLimitStore.size > 2000) {
    for (const [k, bucket] of rateLimitStore.entries()) {
      const fresh = bucket.timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        rateLimitStore.delete(k);
      } else {
        bucket.timestamps = fresh;
      }
    }
  }

  const bucket = rateLimitStore.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateLimitStore.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  bucket.timestamps.push(now);
  rateLimitStore.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    retryAfterSec: 0,
  };
}
