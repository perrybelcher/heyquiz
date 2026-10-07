import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
try {
  await writeFile(
    ".env.local",
    `HEYQUIZ_LOCAL_MODE=1\nSESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Local workspace configured. Run npm run dev -- --hostname 127.0.0.1 --port 3130",
  );
} catch (e) {
  if (e.code === "EEXIST") console.log("Existing .env.local preserved.");
  else throw e;
}
