import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  clearAdminSessionCookie(res, req);
  return res;
}
