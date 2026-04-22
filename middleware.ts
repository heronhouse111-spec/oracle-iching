import { type NextRequest, NextResponse } from "next/server";

const GEO_COOKIE = "oracle_country";

/**
 * 決定 response:先跑 Supabase session refresh(若有設),再疊上 geo cookie。
 */
async function buildResponse(request: NextRequest): Promise<NextResponse> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url_here"
  ) {
    return NextResponse.next();
  }
  const { updateSession } = await import("@/lib/supabase/middleware");
  return await updateSession(request);
}

export async function middleware(request: NextRequest) {
  const response = await buildResponse(request);

  // ---- Geo cookie:用 Vercel 提供的 IP 國碼 ----
  // Vercel 在所有 request 上自動加 x-vercel-ip-country(ISO 3166-1 alpha-2)。
  // 本地開發沒有此 header,這裡會退回 undefined,useCurrency 就走 localStorage 或預設 USD。
  const country = request.headers.get("x-vercel-ip-country");
  if (country) {
    const existing = request.cookies.get(GEO_COOKIE)?.value;
    if (existing !== country) {
      response.cookies.set(GEO_COOKIE, country, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 天;旅遊短期出國不會長期錯判
        sameSite: "lax",
        httpOnly: false, // 必須讓前端 JS 能讀(useCurrency)
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
