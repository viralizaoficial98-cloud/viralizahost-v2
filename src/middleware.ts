import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
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

  const protectedPrefixes = ['/dashboard', '/domains', '/hosting', '/email', '/tickets', '/billing', '/settings']
  const adminPrefixes = ['/admin']
  const authRoutes = ['/login', '/register', '/forgot-password']
  const path = request.nextUrl.pathname

  if (protectedPrefixes.some(r => path.startsWith(r)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (adminPrefixes.some(r => path.startsWith(r)) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (authRoutes.some(r => path.startsWith(r)) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
