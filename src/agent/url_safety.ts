/**
 * Defense-in-depth URL allow-list shared by the network-using tools
 * (`web_fetch`, `web_crawl`). Blocks the usual SSRF targets even before
 * the OS resolves them, so e.g. `http://localhost:6379/...` fails before
 * fetch is called.
 *
 * Intentionally minimal: only http(s), no usernames, block loopback /
 * link-local / RFC1918 literals and common cloud-metadata hostnames.
 * DNS-resolved private ranges aren't covered here; that's a job for a
 * custom Agent (undici) dispatcher if we ever need it.
 */
export function assertPublicUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`invalid URL: ${urlString}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`only http(s) URLs are allowed: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  const blockedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254", // AWS / GCP metadata
    "metadata.google.internal",
  ]);
  if (blockedHosts.has(host)) {
    throw new Error(`host not allowed: ${host}`);
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error(`host not allowed: ${host}`);
  }
  if (/^10\./.test(host)) throw new Error(`host not allowed: ${host}`);
  if (/^192\.168\./.test(host)) throw new Error(`host not allowed: ${host}`);
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    throw new Error(`host not allowed: ${host}`);
  }
  if (/^169\.254\./.test(host)) throw new Error(`host not allowed: ${host}`);
  return url;
}
