import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip Supabase session refresh if env vars not configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_url_here"
  ) {
    return NextResponse.next();
  }

  // Only import and use Supabase middleware when configured
  const { updateSession } = await import("@/lib/supabase/middleware");
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
