import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const cookieStore = cookies();
    cookieStore.set('siwe-session', '', { maxAge: 0 });
    return NextResponse.json({ success: true });
}