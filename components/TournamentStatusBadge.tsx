// components/TournamentStatusBadge.tsx
import React from 'react';

export type TournamentStatus =
    | 'FILLING'
    | 'ACTIVE'
    | 'STARTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'UNKNOWN';

interface TournamentStatusBadgeProps {
    status: TournamentStatus;
    hasStarted?: boolean;
    isActive?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function TournamentStatusBadge({
    status,
    hasStarted,
    isActive,
    className = '',
    size = 'md'
}: TournamentStatusBadgeProps) {
    // Determine the effective status based on status + blockchain states
    const getEffectiveStatus = (): TournamentStatus => {
        if (status === 'COMPLETED') {
            return 'COMPLETED';
        }

        if (status === 'CANCELLED') {
            return 'CANCELLED';
        }

        // If we have blockchain data, use it to refine the status
        if (hasStarted !== undefined && isActive !== undefined) {
            if (!isActive) {
                return 'CANCELLED';
            }

            if (hasStarted) {
                return 'STARTED';
            }

            return status;
        }

        // Default to the provided status
        return status;
    };

    const effectiveStatus = getEffectiveStatus();

    // Get color scheme based on status
    const getColors = () => {
        switch (effectiveStatus) {
            case 'FILLING':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'ACTIVE':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'STARTED':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'COMPLETED':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'CANCELLED':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Get display text
    const getDisplayText = () => {
        switch (effectiveStatus) {
            case 'FILLING':
                return 'Recruiting Players';
            case 'ACTIVE':
                return 'Active';
            case 'STARTED':
                return 'In Progress';
            case 'COMPLETED':
                return 'Completed';
            case 'CANCELLED':
                return 'Cancelled';
            default:
                return 'Unknown';
        }
    };

    // Get icon
    const getIcon = () => {
        switch (effectiveStatus) {
            case 'FILLING':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                    </svg>
                );
            case 'ACTIVE':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                );
            case 'STARTED':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                );
            case 'COMPLETED':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                );
            case 'CANCELLED':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                );
        }
    };

    // Size classes
    const getSizeClasses = () => {
        switch (size) {
            case 'sm':
                return 'px-2 py-1 text-xs';
            case 'lg':
                return 'px-4 py-2 text-base';
            case 'md':
            default:
                return 'px-3 py-1 text-sm';
        }
    };

    const colors = getColors();
    const displayText = getDisplayText();
    const icon = getIcon();
    const sizeClasses = getSizeClasses();

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border ${colors} ${sizeClasses} ${className}`}
        >
            {icon}
            {displayText}
        </span>
    );
}