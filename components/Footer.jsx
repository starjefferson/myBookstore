import React from "react";
import Link from "next/link";
import { BookOpen, ShieldCheck, Zap, Heart, Truck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-[#090A0F] text-zinc-400 text-sm mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-bold text-zinc-100 tracking-tight">CONCIERGE BOOKS</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Nigeria&apos;s premier digital concierge bookstore delivering pristine physical editions of contemporary African and world literature.
            </p>
            <div className="flex items-center gap-2 pt-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>All Systems Operational</span>
            </div>
          </div>

          {/* Curated Categories */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-3">
              Collections
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-sky-400 transition-colors">
                  African Contemporary Fiction
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-sky-400 transition-colors">
                  Business & Wealth Strategy
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-sky-400 transition-colors">
                  Memoirs & African Biographies
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-sky-400 transition-colors">
                  Poetry & Literary Classics
                </Link>
              </li>
            </ul>
          </div>

          {/* How ordering works */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-3">
              Concierge Model
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Secure Paystack Payment
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                Same-day Admin Sourcing
              </li>
              <li className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                Vendor Dispatch Updates
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-3">
              Navigation
            </h4>
            <div className="flex flex-col space-y-2 text-xs">
              <Link href="/" className="hover:text-zinc-100 transition-colors">Marketplace Grid</Link>
              <Link href="/dashboard" className="hover:text-zinc-100 transition-colors">Buyer Order Dashboard</Link>
              <Link href="/admin" className="hover:text-emerald-400 transition-colors">Admin Order Operations</Link>
              <Link href="/checkout" className="hover:text-zinc-100 transition-colors">Express Checkout</Link>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div>
            &copy; {new Date().getFullYear()} Digital Concierge Bookstore. Built with Next.js, Firebase & Paystack.
          </div>
          <div className="flex items-center gap-1 text-zinc-400">
            <span>Powered by Grok Aesthetic Design</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline ml-1" />
          </div>
        </div>
      </div>
    </footer>
  );
}
