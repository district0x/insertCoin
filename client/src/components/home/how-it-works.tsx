"use client";

import * as React from "react";
import { Gamepad2, SwordIcon as Sword, Trophy, Wallet } from "lucide-react";

export default function HowItWorks() {
    const steps = [
        { title: 'Create a Match', desc: 'Choose game, set stake and token.', icon: Gamepad2 },
        { title: 'Compete', desc: 'Players join and battle it out.', icon: Sword },
        { title: 'Winner Paid', desc: 'Smart contract pays out instantly.', icon: Trophy },
    ];

    return (
        <section className="container mx-auto px-4 mt-12 mb-8">
            <h2 className="text-xl font-semibold mb-4">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {steps.map((s, i) => {
                    const Icon = s.icon as any;
                    return (
                        <div key={i} className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-500/20 rounded-xl p-6 text-center">
                            <div className="flex justify-center mb-3">
                                <Icon className="h-6 w-6 text-red-400" />
                            </div>
                            <div className="text-white font-semibold">{s.title}</div>
                            <div className="text-sm text-gray-400 mt-1">{s.desc}</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
} 