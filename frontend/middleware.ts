import { NextResponse, type NextRequest } from 'next/server';

/** Cheap first line of defence: bounce cookie-less visitors before any page JS loads.
 *  The API still validates the JWT on every request; this is purely UX. */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('access_token');
  const isAuthPage = ['/login', '/register'].includes(req.nextUrl.pathname);
  if (!hasSession && !isAuthPage) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next|favicon.ico|manifest.webmanifest|sw.js|icons|login|register).*)'] };
