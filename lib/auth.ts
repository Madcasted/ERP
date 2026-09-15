import crypto from "crypto";

const COOKIE_NAME = "erp_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "erp-development-session-secret";

function sign(value: string) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function createSessionValue(userId: string) {
  const value = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  return `${value}.${sign(value)}`;
}

export function readSessionValue(value?: string | null) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  const expectedSignature = payload ? sign(payload) : "";
  if (!payload || !signature || signature.length !== expectedSignature.length || !crypto.timingSafeEqual(new Uint8Array(Buffer.from(signature)), new Uint8Array(Buffer.from(expectedSignature)))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;