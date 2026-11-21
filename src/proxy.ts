import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Endpoint & halaman login publik untuk autentikasi admin
  const isAdminAuthRoute = pathname.startsWith('/api/admin/auth');
  const isAdminLoginPage = pathname === '/admin/login';

  if (pathname.startsWith('/api/admin') && !isAdminAuthRoute) {
    const adminSession = await getAdminSessionFromRequest(request);
    if (!adminSession) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak: Anda harus login sebagai administrator.',
        },
        { status: 401 }
      );
    }
  }

  if (
    (pathname === '/admin' ||
      pathname.startsWith('/admin/dashboard') ||
      pathname.startsWith('/admin/settings')) &&
    !isAdminLoginPage
  ) {
    const adminSession = await getAdminSessionFromRequest(request);
    if (!adminSession) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
