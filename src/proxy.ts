import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, userFromSessionToken } from '@/lib/auth/server'

// Protecção de rotas (runtime Node.js). Mesmas regras de antes; a sessão passa a
// ser o cookie vh_session validado em MariaDB (antes: cookies sb-* do Supabase).
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Match whole path segments only ('/email' must not catch '/email-corporativo').
  const under = (p: string) => path === p || path.startsWith(`${p}/`)

  const protectedPaths = ['/dashboard', '/domains', '/hosting', '/tickets', '/billing', '/settings']
  // '/email' is the client area page; '/email/*' are public marketing pages.
  const protectedExact = ['/email']
  const adminPaths = ['/admin']
  const authRoutes = ['/login', '/register', '/forgot-password']

  const isProtected = protectedPaths.some(under) || protectedExact.includes(path) || adminPaths.some(under)
  const isAuthRoute = authRoutes.some(under)
  // Páginas públicas não precisam de consultar a base de dados.
  if (!isProtected && !isAuthRoute) return NextResponse.next({ request })

  const token = request.cookies.get(SESSION_COOKIE)?.value
  let user = null
  try {
    user = token ? await userFromSessionToken(token) : null
  } catch (err) {
    console.error('[proxy] falha ao validar sessão:', (err as Error).message)
  }

  if (isProtected && !user) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    if (token) res.cookies.delete(SESSION_COOKIE)
    return res
  }
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next({ request })
}

export const config = {
  // /storage e /api/storage ficam de fora: o proxy limitaria o corpo dos uploads a 10 MB.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|storage/|api/storage/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)'],
}
