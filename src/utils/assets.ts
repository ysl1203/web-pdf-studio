/**
 * Resolves static asset paths relative to the current Vite / Electron base URL.
 * Ensures assets work both in development, production http/https, and Electron file:// protocols.
 */
export function resolveAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || './';
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${cleanPath}`;
}
