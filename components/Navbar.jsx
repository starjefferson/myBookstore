"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import {
  BookOpen,
  ShoppingBag,
  User,
  ShieldCheck,
  Package,
  ClipboardList,
  Search,
  LogOut,
  X
} from "lucide-react";
import AuthModal from "./AuthModal";

function NavbarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { totalItems, setCartOpen } = useCart();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const searchInputRef = useRef(null);

  useEffect(() => {
    setSearchValue(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const updateSearch = (value) => {
    setSearchValue(value);
    const query = value.trim();
    router.replace(query ? `/?q=${encodeURIComponent(query)}` : "/", { scroll: false });
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#090A0F]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-zinc-100 tracking-tight flex items-center gap-1.5">
                MY <span className="text-sky-400 font-mono text-xs px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">BOOKS</span>
              </span>
              <span className="text-[10px] text-zinc-400 -mt-1 tracking-wider uppercase">
                Curated Literature & Nationwide Delivery
              </span>
            </div>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/"
                  ? "text-sky-400 bg-sky-500/10 border border-sky-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              Marketplace
            </Link>
            <Link
              href="/dashboard"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith("/dashboard")
                  ? "text-sky-400 bg-sky-500/10 border border-sky-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Track Orders</span>
            </Link>
            <Link
              href="/order-request"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith("/order-request")
                  ? "text-sky-400 bg-sky-500/10 border border-sky-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Place an Order</span>
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              {searchOpen && (
                <div className="fixed top-[4.5rem] left-4 right-4 z-50 md:absolute md:top-0 md:right-0 md:left-auto md:w-80">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchValue}
                    onChange={(event) => updateSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setSearchOpen(false);
                    }}
                    placeholder="Search title, author, or keyword..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-10 text-sm text-zinc-100 shadow-2xl outline-none transition-colors placeholder:text-zinc-500 focus:border-sky-500"
                    aria-label="Search book catalog"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-200"
                    aria-label="Close search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen((isOpen) => !isOpen)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  searchOpen
                    ? "bg-sky-500/10 border-sky-500/40 text-sky-400"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
                }`}
                aria-label="Search books"
                aria-expanded={searchOpen}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Bag Button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors"
              aria-label="View shopping bag"
            >
              <ShoppingBag className="w-4 h-4 text-sky-400" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#090A0F]">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Auth Button / Profile */}
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-sky-400 border border-zinc-700">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="text-xs font-medium text-zinc-200 hidden sm:inline max-w-[100px] truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400 transition-colors flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<header className="sticky top-0 z-40 h-16 w-full border-b border-zinc-800/80 bg-[#090A0F]/90 backdrop-blur-md" />}>
      <NavbarContent />
    </Suspense>
  );
}
