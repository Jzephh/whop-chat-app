import { NextResponse } from 'next/server';
import { getWhopSdk } from '@/lib/whop';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const whopSdk = getWhopSdk();
    const hdrs = await headers();
    const { userId } = await whopSdk.verifyUserToken(hdrs);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Optionally return user data for UI (typed minimal shape)
    type UserData = {
      id: string;
      name?: string;
      username?: string;
      profilePicture?: { sourceUrl?: string };
      createdAt?: number;
    } | null;
    let user: UserData = null;
    try {
      user = await whopSdk.users.getUser({ userId });
    } catch {}
    return NextResponse.json({ userId, user });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}


