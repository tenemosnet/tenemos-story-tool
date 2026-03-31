import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (password === process.env.APP_PASSWORD) {
    const response = NextResponse.json({ success: true })
    // Cookieにセッショントークンを設定（7日間有効）
    response.cookies.set('auth-token', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7日
    })
    return response
  }

  return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
}
