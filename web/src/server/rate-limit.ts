import "server-only";

/**
 * Simple in-memory rate limiter for the verification endpoint.
 * Protects the relayer wallet from drain-by-abuse. Per-process (resets on
 * restart) — sufficient for the MVP; swap for a store-backed limiter when
 * scaling beyond a single server instance.
 */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
const MAX_PER_IP_HOUR = 30;

const buckets = new Map<string, number[]>();

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

export function rateLimitAllowed(ip: string): boolean {
  return (
    hit(`m:${ip}`, MAX_PER_WINDOW, WINDOW_MS) &&
    hit(`h:${ip}`, MAX_PER_IP_HOUR, 60 * 60 * 1000)
  );
}
