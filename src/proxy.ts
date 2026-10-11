import { NextResponse, type NextRequest } from "next/server";
import {
  SECURE_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/modules/auth/session-cookie";

const SESSION_COOKIES = [SESSION_COOKIE_NAME, SECURE_SESSION_COOKIE_NAME];

/**
 * Yalnızca hızlı (iyimser) yönlendirme: oturum çerezi yoksa girişe gönderir.
 * Asıl yetki kontrolü veri erişim katmanında (requirePermission) yapılır.
 */
export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!hasSession) {
    const loginUrl = new URL("/giris", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
