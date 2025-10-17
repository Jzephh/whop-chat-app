import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import connectDB from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { broadcastJson } from '@/lib/ws';
import { getWhopSdk } from '@/lib/whop';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();
    const userIdVal = formData.get('userId');
    const userId = typeof userIdVal === 'string' ? userIdVal : undefined;
    const file = formData.get('file');

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Verify user exists (optional - can be removed for better performance)
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

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: 'Cloudinary env not configured' }, { status: 500 });
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Use upload_stream to handle larger files reliably
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER || 'whop-chat',
          resource_type: 'auto',
          filename_override: file.name
        },
        (error, res) => {
          if (error || !res) return reject(error || new Error('Upload failed'));
          resolve({ secure_url: res.secure_url!, public_id: res.public_id! });
        }
      );
      stream.end(buffer);
    });

    // Create a message with the uploaded image and broadcast it
    const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID!;
    const message = await Message.create({
      companyId,
      userId,
      username: userData.username,
      name: userData.name,
      avatarUrl: userData.profilePicture?.sourceUrl,
      content: '',
      imageUrl: result.secure_url,
      mentions: []
    });

    broadcastJson({ type: 'message.created', payload: message.toObject ? message.toObject() : message });

    return NextResponse.json(message);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
