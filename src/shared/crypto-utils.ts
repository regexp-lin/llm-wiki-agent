import crypto from "node:crypto";

export function sha256Full(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function sha256Short(text: string): string {
  return sha256Full(text).slice(0, 16);
}
