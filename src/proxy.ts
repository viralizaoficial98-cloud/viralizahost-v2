import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifyToken } from '@/lib/auth/token'

/**
 * Redireciona por estado de sessão. Aqui só se valida a assinatura e a validade
 * do cookie (sem consultar a base de dados); a revogação (session_version) e o
 * papel de admin são verificados nas páginas/rotas (getUser, requireAdminRole).
 */
export default async function proxy(request: NextRequest) {
  const session = verifyToken(request.cookies.get(SESSION_COOKIE)?.value, 'session')
  const user = session ? { id: session.sub } : null

  const path = request.nextUrl.pathname
  // Match whole path segments only ('/email' must not catch '/email-corporativo').
  const under = (p: string) => path === p || path.startsWith(`${p}/`)

  const protectedPaths = ['/dashboard', '/domains', '/hosting', '/tickets', '/billing', '/settings']
  // '/email' is the client area page; '/email/*' are public marketing pages.
  const protectedExact = ['/email']
  const adminPaths = ['/admin']
  const authRoutes = ['/login', '/register', '/forgot-password']

  if ((protectedPaths.some(under) || protectedExact.includes(path)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (adminPaths.some(under) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (authRoutes.some(under) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next({ request })
}

export const config = {
  // /api e /storage ficam fora do proxy: as rotas validam a sessão e os envios grandes
  // (vídeo até 100 MB) não passam pelo buffer do proxy (limite de 10 MB).
  matcher: ['/((?!_next/static|_next/image|api/|storage/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)'],
}
