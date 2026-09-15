import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "erp_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "erp-development-session-secret";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("Invalid signature");
  return Uint8Array.from(value.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

async function isValidSession(value?: string) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encodeText(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encodeText(payload)));
    const actual = decodeHex(signature);
    if (actual.length !== expected.length || actual.some((byte, index) => byte !== expected[index])) return false;

    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return Boolean(session.userId && session.expiresAt > Date.now());
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isLoginApi = pathname === "/api/login" && request.method === "POST";
  const isLogoutApi = pathname === "/api/logout";
  const isPublicAsset = pathname.startsWith("/_next/") || pathname === "/favicon.ico";

  if (isLoginPage || isLoginApi || isLogoutApi || isPublicAsset) return NextResponse.next();

  const validSession = await isValidSession(request.cookies.get(COOKIE_NAME)?.value);
  if (validSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};