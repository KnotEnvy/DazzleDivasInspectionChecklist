// src/app/api/uploads/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ensureUploadsDirectory } from '@/lib/uploadConfig';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow initialization only for authenticated users
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    ensureUploadsDirectory();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error initializing uploads directory:', error);
    return NextResponse.json(
      { error: 'Failed to initialize uploads directory' },
      { status: 500 }
    );
  }
}