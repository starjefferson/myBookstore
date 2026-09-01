"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchBookById, fetchBooks } from "../../../lib/dataService";
import { useCart } from "../../../contexts/CartContext";
import { useToast } from "../../../components/Toast";
import { formatNGN, SHIPPING_ZONES } from "../../../lib/zones";
import { classifyBookCategory } from "../../../lib/categoryTaxonomy";
import BookCard from "../../../components/BookCard";

import { generateBookCoverDataUrl } from "../../../lib/coverGenerator";

// Routes vendor image URLs through the server-side proxy to bypass hotlink protection
function getSafeImageUrl(book) {
  if (!book) return "";
  const raw =
    book.coverImage || book.cover_image || book.image ||
    book.coverUrl || book.cover_url || book.cover ||
    book.imageUrl || book.thumbnail;

  let category = "General";
  try {
    category = classifyBookCategory(book) || "General";
  } catch (e) {}

  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return generateBookCoverDataUrl({
      title: book.title,
      author: book.author,
      category: category,
    });
  }

  let formatted = raw.trim();
  if (formatted.startsWith("//")) formatted = `https:${formatted}`;
  if (formatted.startsWith("data:") || formatted.startsWith("/api/image-proxy")) return formatted;

  const query = new URLSearchParams({
    url: formatted,
    title: book.title || "",
    author: book.author || "",
    category: category,
  });

  return `/api/image-proxy?${query.toString()}`;
}

import {
  ArrowLeft,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Truck,
  Star,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  ArrowRight
} from "lucide-react";

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [book, setBook] = useState(null);
  const [relatedBooks, setRelatedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedZonePreview, setSelectedZonePreview] = useState("Lagos");
  const [coverSrc, setCoverSrc] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchBookById(params.id);
        setBook(data);
        if (data) {
          setCoverSrc(getSafeImageUrl(data));
        }

        const all = await fetchBooks();

        // Pick related books: same category first (shuffled), then fill with others
        const currentCategory = classifyBookCategory(data);
        const others = all.filter((b) => b.id !== params.id);

        const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

        const sameCategory = shuffle(
          others.filter((b) => classifyBookCategory(b) === currentCategory)
        );
        const different = shuffle(
          others.filter((b) => classifyBookCategory(b) !== currentCategory)
        );

        // Fill up to 4: same-category books first, then pad with others
        const related = [...sameCategory, ...different].slice(0, 4);
        setRelatedBooks(related);
      } catch (err) {
        console.error("Error loading book detail", err);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      loadData();
    }
  }, [params.id]);

  // Track Meta Pixel (ViewContent) & Google Analytics (view_item) when book loads
  useEffect(() => {
    if (book && typeof window !== "undefined") {
      const categoryName = classifyBookCategory(book);

      // Meta Pixel ViewContent Event
      if (window.fbq) {
        window.fbq("track", "ViewContent", {
          content_ids: [book.id],
          content_name: book.title,
          content_category: categoryName,
          value: book.retailPrice,
          currency: "NGN",
          content_type: "product",
        });
      }

      // GA4 view_item Event
      if (window.gtag) {
        window.gtag("event", "view_item", {
          currency: "NGN",
          value: book.retailPrice,
          items: [
            {
              item_id: book.id,
              item_name: book.title,
              item_category: categoryName,
              price: book.retailPrice,
              quantity: 1,
            },
          ],
        });
      }
    }
  }, [book]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse flex flex-col md:flex-row gap-12">
          <div className="w-full md:w-1/3 pt-[130%] bg-zinc-800/50 rounded-2xl" />
          <div className="flex-1 space-y-4">
            <div className="w-24 h-6 bg-zinc-800 rounded-full" />
            <div className="w-3/4 h-10 bg-zinc-800 rounded-xl" />
            <div className="w-1/2 h-6 bg-zinc-800 rounded" />
            <div className="w-full h-32 bg-zinc-800/40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Book Not Found</h2>
        <p className="text-sm text-zinc-400 mb-6">
          The requested title is currently not in our dropshipping inventory or has been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Marketplace</span>
        </Link>
      </div>
    );
  }

  const isMasobe = book.sourceVendor === "masobe";
  const bookCategory = classifyBookCategory(book);

  const trackAddToCartEvent = () => {
    if (typeof window !== "undefined") {
      // Meta Pixel AddToCart
      if (window.fbq) {
        window.fbq("track", "AddToCart", {
          content_ids: [book.id],
          content_name: book.title,
          content_type: "product",
          value: book.retailPrice * quantity,
          currency: "NGN",
        });
      }
      // GA4 add_to_cart
      if (window.gtag) {
        window.gtag("event", "add_to_cart", {
          currency: "NGN",
          value: book.retailPrice * quantity,
          items: [
            {
              item_id: book.id,
              item_name: book.title,
              item_category: bookCategory,
              price: book.retailPrice,
              quantity: quantity,
            },
          ],
        });
      }
    }
  };

  const handleBuyNow = () => {
    trackAddToCartEvent();
    addToCart(book, quantity);
    router.push("/checkout");
  };

  const handleAdd = () => {
    trackAddToCartEvent();
    addToCart(book, quantity);
    showToast(`Added ${quantity}x "${book.title}" to bag`, "success");
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-sky-400 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Marketplace</span>
        </Link>

        {/* Book Hero Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 bg-[#0F1117] border border-zinc-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl">
          {/* Left Cover Column */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 bg-zinc-900 group">
              <img
                src={coverSrc || generateBookCoverDataUrl(book)}
                alt={book.title}
                onError={() => {
                  setCoverSrc(
                    generateBookCoverDataUrl({
                      title: book.title,
                      author: book.author,
                      category: bookCategory,
                    })
                  );
                }}
                className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-500"
              />


            </div>

          </div>

          {/* Right Metadata & Purchase Column */}
          <div className="md:col-span-7 flex flex-col justify-between">
            <div>
              {/* Category & Rating */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 font-mono">
                  {bookCategory}
                </span>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-300 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-300" />
                  <span>{book.rating || "4.8"} / 5.0</span>
                </div>
              </div>

              {/* Title & Author */}
              <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight mb-2 leading-tight">
                {book.title}
              </h1>
              <p className="text-base text-zinc-400 font-medium mb-6">
                By <span className="text-zinc-200">{book.author}</span>
              </p>

              {/* Pricing Box */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-baseline justify-between mb-6">
                <div>
                  <div className="text-xs text-zinc-500 font-mono">Concierge Retail Price</div>
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono">
                    {formatNGN(book.retailPrice)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    In Stock &bull; Guaranteed Authentic
                  </span>
                </div>
              </div>

              {/* Synopsis */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-mono">
                  Synopsis & Overview
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {book.description}
                </p>
              </div>

              {/* Book Specs Mini Table */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 mb-6 font-mono">
                <div>
                  <span className="text-zinc-500 block text-[10px]">ISBN</span>
                  <span className="text-zinc-200">{book.isbn || "978-978-001"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">PAGES</span>
                  <span className="text-zinc-200">{book.pages ? `${book.pages} pp` : "Paperback"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">PUBLISHER</span>
                  <span className="text-zinc-200 truncate block">{book.publisher || book.sourceVendor}</span>
                </div>
              </div>
            </div>

            {/* Purchase Action Box */}
            <div className="pt-6 border-t border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Quantity */}
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-zinc-400 hover:text-white"
                  >
                    -
                  </button>
                  <span className="px-3 text-sm font-mono font-bold text-zinc-100">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-zinc-400 hover:text-white"
                  >
                    +
                  </button>
                </div>

                {/* Add to Bag */}
                <button
                  onClick={handleAdd}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-sky-400" />
                  <span>Add to Bag</span>
                </button>

                {/* Instant Buy Now */}
                <button
                  onClick={handleBuyNow}
                  className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Buy Now &bull; {formatNGN(book.retailPrice * quantity)}</span>
                </button>
              </div>

              {/* Concierge Guarantee Notice */}
              <div className="flex items-center gap-2 text-xs text-zinc-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Sourced in real-time by Concierge Admin from {isMasobe ? "Masobe" : "Rovingheights"} upon Paystack confirmation.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Titles */}
        {relatedBooks.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400" />
                <span>Readers Also Enjoyed</span>
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {relatedBooks.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}