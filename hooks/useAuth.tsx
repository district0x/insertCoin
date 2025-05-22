'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAddress, useDisconnect, useSDK, useWallet } from "@thirdweb-dev/react";
import { useRouter } from 'next/navigation';
import { SiweMessage } from 'siwe';

export function useAuth(requiredAuth = false, redirectTo = '/') {
    const address = useAddress();
    const wallet = useWallet();
    const sdk = useSDK();
    const { disconnect } = useDisconnect();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check authentication status
    useEffect(() => {
        const checkAuth = async () => {
            if (!address) {
                setIsAuthenticated(false);
                return;
            }

            try {
                const res = await fetch('/api/auth/me');
                const json = await res.json();
                setIsAuthenticated(json.authenticated === true);
            } catch (e) {
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, [address]);

    // Redirect if auth is required
    useEffect(() => {
        if (requiredAuth && !address) {
            router.push(redirectTo);
        }
    }, [requiredAuth, address, router, redirectTo]);

    // Sign-in with Ethereum
    const signIn = useCallback(async () => {
        if (!address || !wallet || !sdk) {
            setError('Wallet not connected or SDK not initialized');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('Starting sign-in process...');

            // Get nonce from our server
            const nonceRes = await fetch('/api/auth/nonce');
            const nonceData = await nonceRes.json();
            console.log('Nonce response:', nonceData);

            if (!nonceData.nonce) {
                throw new Error('Failed to get nonce from server');
            }

            const nonce = nonceData.nonce;

            // Create SIWE message
            const message = new SiweMessage({
                domain: window.location.host,
                address,
                statement: 'Sign in to Trivia Game',
                uri: window.location.origin,
                version: '1',
                chainId: await wallet.getChainId(),
                nonce,
            });

            // Convert message to string
            const messageToSign = message.prepareMessage();
            console.log('Message to sign:', messageToSign);

            // Sign the message
            const signature = await wallet.signMessage(messageToSign);
            console.log('Signature obtained:', signature);

            // Verify signature
            const verifyRes = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    signature
                }),
            });

            const verifyData = await verifyRes.json();
            console.log('Verification response:', verifyData);

            if (!verifyData.success) {
                throw new Error(verifyData.error || 'Verification failed');
            }

            setIsAuthenticated(true);
            return true;
        } catch (err: any) {
            // More detailed error logging
            console.error('Error signing in:', {
                error: err,
                message: err?.message || 'Unknown error',
                code: err?.code,
                details: err?.details
            });

            // Handle user rejected request (common error)
            if (err?.code === 4001 || err?.message?.includes('user rejected')) {
                setError('You rejected the signature request');
            } else {
                setError(err?.message || 'Failed to sign in');
            }

            return false;
        } finally {
            setIsLoading(false);
        }
    }, [address, wallet, sdk]);

    // Sign out
    const signOut = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setIsAuthenticated(false);
        } catch (err: any) {
            console.error('Error signing out:', err);
            setError(err.message || 'Failed to sign out');
        }
    }, []);

    return {
        address,
        isAuthenticated,
        isLoading,
        error,
        signIn,
        signOut,
        disconnect,
    };
}