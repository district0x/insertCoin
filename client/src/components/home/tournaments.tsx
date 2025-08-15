"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Tournaments() {
  return (
    <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Tournaments
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Join exciting tournaments and compete for amazing prizes
          </p>
        </div>

        <div className="text-center py-8">
          <Card className="bg-gray-900/80 border-red-500/20 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-white">Tournaments Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 text-lg">
                Insert Coin Tournament Coming Soon
              </p>
              <p className="text-gray-400 mt-2">
                We're working on bringing you exciting tournament experiences
              </p>
            </CardContent>
          </Card>
        </div>

        {/* StreamTide Section */}
        <div className="mt-12 flex flex-col items-center">
          <Image
            src="/streamtide.png"
            alt="StreamTide Logo"
            width={104}
            height={96}
            className="mb-4"
          />
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() =>
              window.open(
                "https://streamtide.io/profile/0x944C8e0C05aa90C3C03C16b0703fF66e2ecaa2fa",
                "_blank"
              )
            }
          >
            Support us on StreamTide
          </Button>
        </div>
      </div>
    </section>
  );
}
