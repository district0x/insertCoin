// FILE: /app/api/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message, signature } = body;

        // Get the nonce from cookies
        const nonceCookie = cookies().get('siwe-nonce');
        const nonce = nonceCookie?.value;

        if (!nonce) {
            return NextResponse.json(
                { success: false, error: 'Invalid nonce' },
                { status: 400 }
            );
        }

        // Create a new SiweMessage instance
        const siweMessage = new SiweMessage(message);

        // Validate the signature
        try {
            const { success, data } = await siweMessage.verify({
                signature,
                nonce,
            });

            if (!success) {
                throw new Error('Invalid signature');
            }

            // Create response object
            const response = NextResponse.json({ success: true });

            // Clear the nonce cookie
            response.cookies.set('siwe-nonce', '', { maxAge: 0 });

            // Set the session cookie
            response.cookies.set('siwe-session', JSON.stringify({
                address: siweMessage.address,
                chainId: siweMessage.chainId,
                authenticated: true,
            }), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: '/',
            });

            return response;
        } catch (verifyError) {
            console.error('Verification error:', verifyError);
            return NextResponse.json(
                { success: false, error: 'Invalid signature' },
                { status: 401 }
            );
        }
    } catch (error) {
        console.error('Error verifying signature:', error);
        return NextResponse.json(
            { success: false, error: 'Error verifying signature' },
            { status: 400 }
        );
    }
}