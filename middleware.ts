import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // 認証API自体はスキップ
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Cron APIはCookie認証不要（Bearer tokenで独自認証する）
  if (request.nextUrl.pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  // ログインページはスキップ
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next()
  }

  // 認証チェック
  const token = request.cookies.get('auth-token')?.value
  if (token !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // 静的ファイルと_next以外の全パスにマッチ
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
