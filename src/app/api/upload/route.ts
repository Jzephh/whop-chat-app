import { NextRequest, NextResponse } from 'next/server';
import { getWhopSdk } from '@/lib/whop';
import { headers } from 'next/headers';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const whopSdk = getWhopSdk();
    const { userId } = await whopSdk.verifyUserToken(await headers());
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const arrayBuffer = await file.arrayBuffer();
    const uploadResult = await cloudinary.uploader.upload(`data:${file.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`, {
      folder: process.env.CLOUDINARY_FOLDER || 'whop-chat',
      resource_type: 'image'
    });

    return NextResponse.json({ url: uploadResult.secure_url, publicId: uploadResult.public_id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

