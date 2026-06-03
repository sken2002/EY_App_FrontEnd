import { NextResponse } from 'next/server';

// In a real app, use environment variables and hashing (e.g. bcrypt)
// For this prototype, a hardcoded secure passcode is sufficient to lock down the UI.
const MASTER_PASSCODE = process.env.EY_MASTER_PASSCODE || 'eymanager2026';

export async function POST(req: Request) {
  try {
    const { passcode } = await req.json();

    if (passcode === MASTER_PASSCODE) {
      // Create response indicating success
      const response = NextResponse.json({ success: true });

      // Set HTTP-only secure cookie for authentication
      // Max-Age: 24 hours (60 * 60 * 24 = 86400 seconds)
      response.cookies.set({
        name: 'ey_spider_auth',
        value: 'authenticated',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      });

      return response;
    }

    // Invalid passcode
    return NextResponse.json(
      { success: false, message: 'Invalid authentication code.' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Authentication error.' },
      { status: 500 }
    );
  }
}
