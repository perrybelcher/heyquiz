import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  // Only global unicast IPv6; exclude documentation, transition and special-use ranges.
  return (
    isIP(address) === 6 &&
    /^[23][0-9a-f]{3}:/i.test(address) &&
    !/^2001:(?:0*:|0*[012][0-9a-f]{0,2}:|db8:)/i.test(address) &&
    !/^2002:/i.test(address) &&
    !/^3fff:/i.test(address)
  );
}
export function webhookUrl(value: string) {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw Error("Enter a valid HTTPS webhook URL.");
  }
  if (
    u.protocol !== "https:" ||
    (u.port && u.port !== "443") ||
    u.username ||
    u.password ||
    u.hash ||
    !u.hostname.includes(".") ||
    u.hostname.endsWith(".") ||
    /(?:^|\.)(localhost|local|internal|test|invalid)$/i.test(u.hostname) ||
    (isIP(u.hostname.replace(/^\[|\]$/g, "")) &&
      !publicAddress(u.hostname.replace(/^\[|\]$/g, "")))
  )
    throw Error(
      "Use a public HTTPS destination on port 443, without embedded credentials or fragments.",
    );
  return u;
}
export interface HttpResult {
  status: number;
  body: string;
  retryAfter?: string;
}
export type Sender = (
  url: string,
  body: string,
  headers: Record<string, string>,
  method?: "POST" | "PATCH" | "GET",
) => Promise<HttpResult>;
export const sendHttps: Sender = async (
  value,
  body,
  headers,
  method = "POST",
) => {
  const url = webhookUrl(value);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Error("Destination must resolve only to public IP addresses.");
  const pinned = addresses.find((a) => a.family === 4) || addresses[0];
  // Pin the validated address to prevent DNS rebinding; HTTPS still validates the original hostname.
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        agent: false,
        family: pinned.family,
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address, pinned.family),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body)),
          ...headers,
        },
      },
      (res) => {
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 65536)
            req.destroy(Error("Destination response was too large."));
          else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 500,
            body: Buffer.concat(chunks).toString(),
            retryAfter: String(res.headers["retry-after"] || ""),
          }),
        );
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(Error("Destination timed out.")),
      10000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end(body);
  });
};
