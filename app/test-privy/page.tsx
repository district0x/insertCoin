'use client';

import PrivyLogin from '@/components/PrivyLogin';
import { PrivyDiagnostic } from '@/components/PrivyDiagnostic';

export default function TestPrivyPage() {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Privy Integration Test
                    </h1>
                    <p className="text-lg text-gray-600">
                        Test and troubleshoot Privy authentication
                    </p>
                </div>

                {/* Diagnostic Tool */}
                <PrivyDiagnostic />

                {/* Simple Login Test */}
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        Login Test
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Try the different login methods below
                    </p>
                    <PrivyLogin />
                </div>
            </div>
        </div>
    );
} 