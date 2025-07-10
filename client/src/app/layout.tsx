import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletGuardProvider } from "@/providers/WalletGuardProvider";
import { Toaster } from "@/components/ui/toaster";
import Footer from "@/components/layout/footer";

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
    <html lang="en" className="h-full">
      <body
        className={`${inter.className} min-h-screen flex flex-col noodle-theme`}
        suppressHydrationWarning={true}
      >
        <Providers>
          <WalletGuardProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <Toaster />
          </WalletGuardProvider>
        </Providers>
      </body>
    </html>
  );
}
