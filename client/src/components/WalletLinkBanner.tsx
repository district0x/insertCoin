"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ArrowRight, X } from "lucide-react";

interface WalletLinkBannerProps {
    onDismiss?: () => void;
    showDismiss?: boolean;
}

export function WalletLinkBanner({ onDismiss, showDismiss = true }: WalletLinkBannerProps) {
    return (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <div>
                            <h3 className="font-semibold text-blue-900">
                                Link Your Discord Wallet
                            </h3>
                            <p className="text-sm text-blue-700">
                                Connect your wallet to Discord for secure match creation and statistics tracking
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/link-wallet">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                Link Now
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        </Link>
                        {showDismiss && onDismiss && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDismiss}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 