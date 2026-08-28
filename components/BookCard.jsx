"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../contexts/CartContext";
import { useToast } from "./Toast";
import { formatNGN } from "../lib/zones";
import { classifyBookCategory } from "../lib/categoryTaxonomy";
import { ShoppingBag, ArrowRight, Star, ExternalLink, Zap } from "lucide-react";

export default function BookCard({ book }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isMasobe = book.sourceVendor === "masobe";
  const bookCategory = classifyBookCategory(book);

  const handleQuickBuy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(book, 1);
    router.push("/checkout");
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(book, 1);
    showToast(`Added "${book.title}" to your bag`, "success");
  };

  const fallbackImage = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600";

  return (
    <div className="group relative bg-[#0F1117] hover:bg-[#131620] border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-full hover:shadow-2xl hover:shadow-sky-500/5">
      {/* Book Cover Container */}
      <Link href={`/book/${book.id}`} className="relative block w-full pt-[125%] bg-zinc-900 overflow-hidden">
        {/* Placeholder skeleton before load */}
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-zinc-800/40 animate-pulse flex items-center justify-center text-zinc-600 text-xs">
            Loading cover...
          </div>
        )}

        <img
          src={imgError ? fallbackImage : book.coverImage || fallbackImage}
          alt={book.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Category Pill Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide shadow-md backdrop-blur-md bg-zinc-950/80 text-zinc-300 border border-zinc-700/60 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {bookCategory}
          </span>
        </div>

        {/* Rating or Stock */}
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-black/60 backdrop-blur-md text-amber-300 border border-zinc-700/50">
            <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
            {book.rating || "4.8"}
          </span>
        </div>
      </Link>

      {/* Book Metadata & Actions */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
            {bookCategory}
          </div>

          <Link href={`/book/${book.id}`} className="block group-hover:text-sky-400 transition-colors">
            <h3 className="text-sm font-bold text-zinc-100 line-clamp-1 leading-snug">
              {book.title}
            </h3>
          </Link>

          <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
            by {book.author || "Unknown Author"}
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-zinc-500 font-mono">Retail Price</div>
            <div className="text-base font-bold text-emerald-400 font-mono tracking-tight">
              {formatNGN(book.retailPrice)}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAddToCart}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Add to Bag"
            >
              <ShoppingBag className="w-4 h-4 text-sky-400" />
            </button>

            <button
              onClick={handleQuickBuy}
              className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1"
            >
              <span>Buy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
