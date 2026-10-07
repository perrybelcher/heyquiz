import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
function key() {
  const source = process.env.INTEGRATION_SECRET || process.env.SESSION_SECRET;
  if (!source || source.length < 32)
    throw new Error("Integration credential encryption is not configured.");
  return Buffer.from(
    hkdfSync("sha256", source, "heyquiz", "integration-credentials-v1", 32),
  );
}
export function seal(value: Record<string, string>, scope: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(scope));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}
export function unseal(value: string, scope: string): Record<string, string> {
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1") throw Error();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64url"),
    );
    cipher.setAAD(Buffer.from(scope));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(
      Buffer.concat([
        cipher.update(Buffer.from(data, "base64url")),
        cipher.final(),
      ]).toString(),
    );
  } catch {
    throw new Error(
      "Saved credentials could not be opened. Re-enter them in Integrate.",
    );
  }
}
