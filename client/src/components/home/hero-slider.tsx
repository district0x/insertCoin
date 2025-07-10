"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Gamepad2, Users, Wallet } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

interface HeroCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    buttonText: string;
    buttonHref?: string;
    onClick?: () => void;
    className?: string;
}

function HeroCard({ title, description, icon, buttonText, buttonHref, onClick, className }: HeroCardProps) {
    const content = (
        <div className={`bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 h-full flex flex-col justify-between ${className}`}>
            <div className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-red-500/20 rounded-full">
                        {icon}
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-300 text-sm">{description}</p>
            </div>
            <div className="mt-4">
                <Button
                    onClick={onClick}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                    {buttonText}
                </Button>
            </div>
        </div>
    );

    if (buttonHref) {
        return <Link href={buttonHref}>{content}</Link>;
    }

    return content;
}

export default function HeroSlider() {
    const [currentSlide, setCurrentSlide] = React.useState(0);
    const { login, authenticated } = usePrivy();

    const slides = [
        {
            title: "Trivia Game",
            description: "Join our first tournament! Test your knowledge and win prizes.",
            icon: <Gamepad2 className="h-8 w-8 text-red-400" />,
            buttonText: "Coming Soon",
            buttonHref: "#",
        },
        {
            title: "Connect Wallet",
            description: "Link your wallet and connect to Discord to start playing.",
            icon: <Wallet className="h-8 w-8 text-red-400" />,
            buttonText: authenticated ? "Connected" : "Sign In",
            onClick: authenticated ? undefined : login,
        },
        {
            title: "1v1 MATCHES",
            description: "Challenge players in competitive 1v1 battles with real prizes.",
            icon: <Users className="h-8 w-8 text-red-400" />,
            buttonText: "View Matches",
            buttonHref: "/matches",
        },
    ];

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    return (
        <section className="relative py-20 bg-gradient-to-br from-black via-gray-900 to-black">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                        Insert Coin
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
                        The ultimate Web3 gaming platform for competitive matches with real prizes
                    </p>
                </div>

                <div className="relative max-w-6xl mx-auto">
                    {/* Navigation Buttons */}
                    <button
                        onClick={prevSlide}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-colors"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="h-6 w-6 text-white" />
                    </button>

                    <button
                        onClick={nextSlide}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-colors"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="h-6 w-6 text-white" />
                    </button>

                    {/* Slides Container */}
                    <div className="overflow-hidden">
                        <div
                            className="flex transition-transform duration-500 ease-in-out"
                            style={{ transform: `translateX(-${currentSlide * 33.333}%)` }}
                        >
                            {slides.map((slide, index) => (
                                <div key={index} className="w-1/3 flex-shrink-0 px-4">
                                    <HeroCard
                                        title={slide.title}
                                        description={slide.description}
                                        icon={slide.icon}
                                        buttonText={slide.buttonText}
                                        buttonHref={slide.buttonHref}
                                        onClick={slide.onClick}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Slide Indicators */}
                    <div className="flex justify-center mt-8 space-x-2">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`w-3 h-3 rounded-full transition-colors ${index === currentSlide ? 'bg-red-500' : 'bg-gray-600'
                                    }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
} 