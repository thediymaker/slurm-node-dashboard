/**
 * Sub-path the app is served under, e.g. "/slurm/cluster1" behind a reverse proxy.
 * Set NEXT_PUBLIC_BASE_PATH at build time; next.config.js normalizes it.
 * next/link, the router and redirect() add it automatically. Plain fetches,
 * asset URLs and cookie paths need withBasePath().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a root-relative path (an API route, "/logo.png") with the base path.
 * Absolute and protocol-relative URLs are returned unchanged.
 */
export const withBasePath = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") ? `${BASE_PATH}${path}` : path;
