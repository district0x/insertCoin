// FILE: /app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const sessionCookie = cookies().get('siwe-session');

        if (!sessionCookie?.value) {
            return NextResponse.json({ authenticated: false });
        }

        try {
            const session = JSON.parse(sessionCookie.value);
            return NextResponse.json({
                authenticated: true,
                address: session.address,
                chainId: session.chainId,
            });
        } catch (e) {
            console.error('Error parsing session cookie:', e);
            return NextResponse.json({ authenticated: false });
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        return NextResponse.json({ authenticated: false });
    }
}