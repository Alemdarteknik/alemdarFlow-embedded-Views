import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Check if user is authenticated (simple check for sessionStorage will be done client-side)
  const { pathname } = request.nextUrl;

  // Allow access to login page
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/systems/all", request.url));
  }

  // Redirect root to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/systems/all", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home", "/systems/:path*", "/dashboard/:path*"],
};
