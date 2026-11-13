import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

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

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)'],
}
