"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../contexts/CartContext";
import { useToast } from "./Toast";
import { formatNGN } from "../lib/zones";
import { classifyBookCategory } from "../lib/categoryTaxonomy";
import { ShoppingBag, ArrowRight, Star } from "lucide-react";

const NEUTRAL_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'><rect width='400' height='500' fill='%2318181b'/><path d='M150 200h100v100H150z' fill='%2327272a'/><text x='200' y='250' font-family='sans-serif' font-size='14' fill='%2371717a' text-anchor='middle' dominant-baseline='middle'>No Cover Available</text></svg>";

// Fail-safe helper to parse vendor image URLs without throwing URIErrors.
// On production all vendor images are proxied through /api/image-proxy to
// bypass hotlink protection (rhbooks.com.ng, masobe, etc. block external Referers).
function getSafeImageUrl(book) {
  if (!book) return NEUTRAL_PLACEHOLDER;

  const raw =
    book.coverImage ||
    book.cover_image ||
    book.image ||
    book.coverUrl ||
    book.cover_url ||
    book.cover ||
    book.imageUrl ||
    book.thumbnail;

  if (!raw || typeof raw !== "string") return NEUTRAL_PLACEHOLDER;

  let formatted = raw.trim();
  if (formatted.startsWith("//")) {
    formatted = `https:${formatted}`;
  }

  // Skip proxying data URIs and already-proxied paths
  if (formatted.startsWith("data:") || formatted.startsWith("/api/image-proxy")) {
    return formatted;
  }

  // Route through server-side proxy — strips Referer header so vendor
  // hotlink protection doesn't block the image on Vercel.
  return `/api/image-proxy?url=${encodeURIComponent(formatted)}`;
}

export default function BookCard({ book }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [imgError, setImgError] = useState(false);

  if (!book) return null;

  let bookCategory = "General";
  try {
    bookCategory = classifyBookCategory(book) || "General";
  } catch (e) {
    bookCategory = "General";
  }

  const imageSrc = imgError ? NEUTRAL_PLACEHOLDER : getSafeImageUrl(book);
  const price = book.retailPrice || book.price || 0;
  const bookId = book.id || book._id;

  const handleQuickBuy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (addToCart) addToCart(book, 1);
    router.push("/checkout");
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (addToCart) addToCart(book, 1);
    if (showToast) showToast(`Added "${book.title || 'Book'}" to your bag`, "success");
  };

  return (
    <div className="group relative bg-[#0F1117] hover:bg-[#131620] border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-full hover:shadow-2xl hover:shadow-sky-500/5">
      {/* Book Cover Container */}
      <Link href={`/book/${bookId}`} className="relative block w-full pt-[125%] bg-zinc-900 overflow-hidden">
        <img
          src={imageSrc}
          alt={book.title || "Book Cover"}
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />

        {/* Category Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide shadow-md backdrop-blur-md bg-zinc-950/80 text-zinc-300 border border-zinc-700/60 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {bookCategory}
          </span>
        </div>

        {/* Rating */}
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

          <Link href={`/book/${bookId}`} className="block group-hover:text-sky-400 transition-colors">
            <h3 className="text-sm font-bold text-zinc-100 line-clamp-1 leading-snug">
              {book.title || "Untitled Book"}
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
              {formatNGN(price)}
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