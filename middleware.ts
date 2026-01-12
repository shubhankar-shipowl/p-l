import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Redirect signup page to login
    if (req.nextUrl.pathname === "/signup") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/signup",
    "/upload/:path*",
    "/marketing/:path*",
    "/api/dashboard/:path*",
    "/api/upload/:path*",
    "/api/marketing-spend/:path*",
  ],
};

