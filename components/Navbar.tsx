"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { UserMenu } from "./UserMenu";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Hide navbar on login page
  if (pathname === "/login") {
    return null;
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const linkBase =
    "text-sm font-medium transition-colors px-2 py-1 rounded-md";

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            P&L Dashboard
          </Link>
          {session && (
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className={`${linkBase} ${
                  isActive("/") ? "text-primary font-semibold" : "text-gray-800 hover:text-primary"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/upload"
                className={`${linkBase} ${
                  isActive("/upload")
                    ? "text-primary font-semibold"
                    : "text-gray-800 hover:text-primary"
                }`}
              >
                Upload Data
              </Link>
              <Link
                href="/marketing"
                className={`${linkBase} ${
                  isActive("/marketing")
                    ? "text-primary font-semibold"
                    : "text-gray-800 hover:text-primary"
                }`}
              >
                Marketing Spend
              </Link>
              <Link
                href="/price-management"
                className={`${linkBase} ${
                  isActive("/price-management")
                    ? "text-primary font-semibold"
                    : "text-gray-800 hover:text-primary"
                }`}
              >
                Price & HSN
              </Link>
              <Link
                href="/data-management"
                className={`${linkBase} ${
                  isActive("/data-management")
                    ? "text-primary font-semibold"
                    : "text-gray-800 hover:text-primary"
                }`}
              >
                Data Management
              </Link>
              <Link
                href="/profile"
                className={`${linkBase} ${
                  isActive("/profile")
                    ? "text-primary font-semibold"
                    : "text-gray-800 hover:text-primary"
                }`}
              >
                Profile
              </Link>
              <UserMenu />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

