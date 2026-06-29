import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
  const protectedPaths = ['/dashboard', '/domains', '/hosting', '/email', '/tickets', '/billing', '/settings']
  const adminPaths = ['/admin']
  const authRoutes = ['/login', '/register', '/forgot-password']

  if (protectedPaths.some(p => path.startsWith(p)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (adminPaths.some(p => path.startsWith(p)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (authRoutes.some(p => path.startsWith(p)) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
