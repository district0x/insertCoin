import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletGuardProvider } from "@/providers/WalletGuardProvider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "OneVOne - Web3 Gaming Platform",
  description: "Decentralized gaming platform for 1v1, 2v2, and 5v5 matches",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <WalletGuardProvider>
            <Navbar />
            <main className="container mx-auto px-4 py-8">{children}</main>
            <Toaster />
          </WalletGuardProvider>
        </Providers>
      </body>
    </html>
  );
}
