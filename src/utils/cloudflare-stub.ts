/**
 * Client-side stub for cloudflare:workers
 * This file is used on the client to prevent import errors.
 * The actual cloudflare:workers module is only available server-side.
 */

export const env = new Proxy({} as any, {
  get() {
    throw new Error("Cloudflare env is not available on the client side");
  },
});
