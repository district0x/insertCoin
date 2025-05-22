// FILE: /app/api/auth/nonce/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateNonce } from 'siwe';

export async function GET() {
    try {
        // Generate a new nonce
        const nonce = generateNonce();

        // Create the response first
        const response = NextResponse.json({ nonce });

        // Set the nonce cookie in the response
        response.cookies.set('siwe-nonce', nonce, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 5, // 5 minutes
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Error generating nonce:', error);
        return NextResponse.json(
            { error: 'Failed to generate nonce' },
            { status: 500 }
        );
    }
}