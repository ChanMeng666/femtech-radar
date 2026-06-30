import { createHash } from "node:crypto";
export function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}
