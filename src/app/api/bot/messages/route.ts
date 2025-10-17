import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { getWhopSdk } from '@/lib/whop';
import { broadcastJson } from '@/lib/ws';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { userId, content, imageUrl, mentions = [] } = await request.json();
    
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    
    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'Message content or image is required' }, { status: 400 });
    }

    // Verify user exists and get user data
    const whopSdk = getWhopSdk();
    let userData;
    try {
      userData = await whopSdk.users.getUser({ userId });
      if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'User verification failed' }, { status: 403 });
    }

    const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID!;
    
    const message = await Message.create({
      companyId,
      userId,
      username: userData.username,
      name: userData.name,
      avatarUrl: userData.profilePicture?.sourceUrl,
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
