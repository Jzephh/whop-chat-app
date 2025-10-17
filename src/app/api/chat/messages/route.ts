import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { getWhopSdk } from '@/lib/whop';
import { headers } from 'next/headers';
import { broadcastJson } from '@/lib/ws';

export async function GET(request: NextRequest) {
  await connectDB();
  const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID!;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  const items = await Message.find({ companyId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(items.reverse());
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const whopSdk = getWhopSdk();
    const hdrs = await headers();
    const { userId } = await whopSdk.verifyUserToken(hdrs);
    const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID!;

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const content: string | undefined = body.content?.toString();
    const imageUrl: string | undefined = body.imageUrl?.toString();
    const mentions = Array.isArray(body.mentions) ? body.mentions : [];

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'Message content or image is required' }, { status: 400 });
    }

    // fetch detailed user info for display
    const userData = await whopSdk.users.getUser({ userId: userId as string });

    const message = await Message.create({
      companyId,
      userId,
      username: userData?.username || body.username,
      name: userData?.name,
      avatarUrl: userData?.profilePicture?.sourceUrl,
      content,
      imageUrl,
      mentions
    });

    // Broadcast to real-time subscribers (WS + SSE)
    broadcastJson({ type: 'message.created', payload: message.toObject ? message.toObject() : message });

    return NextResponse.json(message);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

