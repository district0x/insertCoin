"use client";

import * as React from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/matches", label: "Matches" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/link-wallet", label: "Link Wallet" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About One v One" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const pathname = usePathname();
  const { login, logout, authenticated, user, ready } = usePrivy();

  const isActive = (path: string): boolean => pathname === path;

  // Close mobile menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const mobileMenu = document.getElementById("mobile-menu");
      if (mobileMenu && !mobileMenu.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close mobile menu on route change
  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleAuthClick = () => {
    if (authenticated) {
      logout();
    } else {
      login();
    }
  };

  return (
    <header className="border-b bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link
            href="/"
            className="text-2xl font-bold hover:text-white/80 transition-colors"
          >
            One v One
          </Link>
          <nav className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-white/80",
                  isActive(item.href) && "text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {ready && (
            <>
              {authenticated ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span>
                      {user?.email?.address || user?.wallet?.address?.slice(0, 6) + "..." + user?.wallet?.address?.slice(-4) || "User"}
                    </span>
                  </div>
                  <Button
                    onClick={handleAuthClick}
                    variant="outline"
                    size="sm"
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleAuthClick}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Connect Wallet
                </Button>
              )}
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-800 transition-colors"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            <span className="sr-only">
              {isOpen ? "Close main menu" : "Open main menu"}
            </span>
            {isOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-gray-900 border-t border-gray-800 absolute w-full z-50"
        >
          <nav className="container mx-auto px-4 py-3 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block py-2 px-3 text-base font-medium rounded-md transition-colors hover:bg-gray-800",
                  isActive(item.href)
                    ? "bg-gray-800 text-primary"
                    : "text-gray-200"
                )}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {ready && (
              <div className="pt-3 border-t border-gray-800">
                {authenticated ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2 text-sm text-gray-300">
                      {user?.email?.address || user?.wallet?.address?.slice(0, 6) + "..." + user?.wallet?.address?.slice(-4) || "User"}
                    </div>
                    <Button
                      onClick={() => {
                        handleAuthClick();
                        setIsOpen(false);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full text-white border-white/20 hover:bg-white/10"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      handleAuthClick();
                      setIsOpen(false);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    Connect Wallet
                  </Button>
                )}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
