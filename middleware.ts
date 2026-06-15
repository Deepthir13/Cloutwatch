import { NextResponse } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";

const clientBlockedRoutes = [
  "/roi-analyzer",
  "/meeting-notes",
  "/pre-meeting-brief",
  "/upload",
];

function startsWithRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default withAuth(
  function middleware(request: NextRequestWithAuth) {
    const pathname = request.nextUrl.pathname;
    const role = request.nextauth.token?.role;

    if (
      role === "client" &&
      clientBlockedRoutes.some((route) => startsWithRoute(pathname, route))
    ) {
      return NextResponse.redirect(new URL("/brand-portal", request.url));
    }

    if (role === "employee" && startsWithRoute(pathname, "/brand-portal")) {
      return NextResponse.redirect(new URL("/roi-analyzer", request.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export const config = {
  matcher: [
    "/roi-analyzer/:path*",
    "/meeting-notes/:path*",
    "/pre-meeting-brief/:path*",
    "/upload/:path*",
    "/brand-portal/:path*",
  ],
};
