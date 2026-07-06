import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  const isPublicPage = req.nextUrl.pathname.startsWith('/p/')
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
  const isPublicApi = req.nextUrl.pathname.startsWith('/api/p/')

  if (isAuthPage || isPublicPage || isApiAuth || isPublicApi) return NextResponse.next()
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
}
