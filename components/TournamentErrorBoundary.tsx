// components/TournamentErrorBoundary.tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { formatTournamentError } from '@/lib/tournamentErrorHandler';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class TournamentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log the error to an error reporting service
        console.error('Tournament component error:', error, errorInfo);

        // Update state with error details
        this.setState({
            errorInfo
        });

        // Call the onError callback if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    // Reset the error state
    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    }

    render(): ReactNode {
        const { hasError, error, errorInfo } = this.state;
        const { children, fallback } = this.props;

        if (hasError) {
            // Format the error message
            const errorMessage = error ? formatTournamentError(error) : 'An unknown error occurred';

            // Use custom fallback if provided, otherwise show default error UI
            if (fallback) {
                return fallback;
            }

            return (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h3 className="font-medium">Something went wrong</h3>
                    </div>

                    <p className="mb-3">{errorMessage}</p>

                    <div className="flex gap-2">
                        <button
                            onClick={this.handleReset}
                            className="px-3 py-1 bg-white text-red-600 rounded border border-red-200 text-sm hover:bg-red-50"
                        >
                            Try Again
                        </button>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-3 py-1 bg-white text-red-600 rounded border border-red-200 text-sm hover:bg-red-50"
                        >
                            Reload Page
                        </button>
                    </div>

                    {/* Show technical details in development */}
                    {process.env.NODE_ENV === 'development' && errorInfo && (
                        <div className="mt-4 pt-3 border-t border-red-200">
                            <details className="text-xs">
                                <summary className="cursor-pointer text-sm font-medium mb-1">Technical Details</summary>
                                <pre className="mt-2 p-2 bg-gray-800 text-white rounded-md overflow-auto whitespace-pre-wrap">
                                    {error && error.toString()}
                                </pre>
                                {errorInfo.componentStack && (
                                    <div className="mt-2">
                                        <h4 className="text-sm font-medium mb-1">Component Stack</h4>
                                        <pre className="p-2 bg-gray-800 text-white rounded-md overflow-auto whitespace-pre-wrap">
                                            {errorInfo.componentStack}
                                        </pre>
                                    </div>
                                )}
                            </details>
                        </div>
                    )}
                </div>
            );
        }

        // If there's no error, render children normally
        return children;
    }
}

// Functional component wrapper for the error boundary
interface TournamentErrorHandlerProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export function TournamentErrorHandler({
    children,
    fallback,
    onError
}: TournamentErrorHandlerProps) {
    return (
        <TournamentErrorBoundary
            fallback={fallback}
            onError={onError}
        >
            {children}
        </TournamentErrorBoundary>
    );
}