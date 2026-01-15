import { env } from "cloudflare:workers";

/**
 * Cloudflare Workers environment bindings
 * Provides type-safe access to D1, R2, KV, and Queues
 */

/**
 * Get the full Cloudflare environment bindings
 * @returns The Cloudflare Env object
 */
export function getEnv(): Env {
  return env as Env;
}

/**
 * Get the D1 database instance
 * @returns D1Database instance for SQL operations
 * @throws Error if database is not available
 */
export function getDB(): D1Database {
  const env = getEnv();
  if (!env?.DB) {
    throw new Error("D1 Database not available");
  }
  return env.DB;
}

/**
 * Get the R2 bucket instance for file storage
 * @returns R2Bucket instance for object storage
 * @throws Error if bucket is not available
 */
export function getBucket(): R2Bucket {
  const env = getEnv();
  if (!env?.ATTACHMENTS) {
    throw new Error("R2 Bucket not available");
  }
  return env.ATTACHMENTS;
}

/**
 * Get the KV namespace for key-value storage
 * @returns KVNamespace instance for session/cache storage
 * @throws Error if KV is not available
 */
export function getKV(): KVNamespace {
  const env = getEnv();
  if (!env?.KV) {
    throw new Error("KV Namespace not available");
  }
  return env.KV;
}

/**
 * Get the delivery queue for async message processing
 * @returns Queue instance for message delivery
 * @throws Error if queue is not available
 */
export function getDeliveryQueue(): Queue {
  const env = getEnv();
  if (!env?.DELIVERY_QUEUE) {
    throw new Error("Delivery Queue not available");
  }
  return env.DELIVERY_QUEUE;
}

/**
 * Get the execution context for waitUntil operations
 * Note: ExecutionContext is not directly available via cloudflare:workers
 * Use getEvent() from vinxi/http if you need the execution context
 */
export function getExecutionContext(): ExecutionContext | undefined {
  return undefined;
}

/**
 * Get environment variable from Cloudflare env
 * @param key The environment variable key
 * @returns The value or undefined
 */
export function getEnvVar<K extends keyof Env>(key: K): Env[K] | undefined {
  return getEnv()[key];
}
