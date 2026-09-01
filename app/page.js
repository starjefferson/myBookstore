"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { fetchBooks } from "../lib/dataService";
import { BOOK_CATEGORIES, classifyBookCategory } from "../lib/categoryTaxonomy";
import BookCard from "../components/BookCard";
import SkeletonCard from "../components/SkeletonCard";
import {
  Sparkles,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  RotateCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const BOOKS_PER_PAGE = 24;

const shuffleBooks = (books) => {
  const shuffled = [...books];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("all"); // 'all' | 'masobe' | 'rovingheights'
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("featured");

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await fetchBooks();
      setBooks(shuffleBooks(data));
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load books", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const categories = useMemo(() => {
    const categoryCounts = new Map();

    books.forEach((book) => {
      const category = classifyBookCategory ? classifyBookCategory(book) : book.category;
      if (category) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      }
    });

    return [
      { name: "All Categories" },
      ...Array.from(categoryCounts.entries())
        .map(([name]) => ({ name }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    ];
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books
      .filter((book) => {
        // Vendor filter
        if (selectedVendor !== "all" && book.sourceVendor !== selectedVendor) {
          return false;
        }
        // Category filter
        if (selectedCategory !== "All Categories") {
          const bookCategory = classifyBookCategory ? classifyBookCategory(book) : book.category;
          if (
            bookCategory?.toLowerCase() !== selectedCategory.toLowerCase() &&
            book.category?.toLowerCase() !== selectedCategory.toLowerCase()
          ) {
            return false;
          }
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = book.title?.toLowerCase().includes(q);
          const matchAuthor = book.author?.toLowerCase().includes(q);
          const matchDesc = book.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchAuthor && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return (a.retailPrice || 0) - (b.retailPrice || 0);
        if (sortBy === "price-desc") return (b.retailPrice || 0) - (a.retailPrice || 0);
        if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });
  }, [books, selectedVendor, selectedCategory, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PER_PAGE));
  const paginatedBooks = filteredBooks.slice(
    (currentPage - 1) * BOOKS_PER_PAGE,
    currentPage * BOOKS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVendor, selectedCategory, searchQuery, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100">
      {/* Hero Section */}
      <section className="relative border-b border-zinc-800/80 bg-gradient-to-b from-zinc-950 via-[#0D0F17] to-[#090A0F] py-16 sm:py-24 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-sky-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[300px] bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-zinc-100 tracking-tight leading-[1.1] mb-6">
              Authentic African & International Literature,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
                Delivered Nationwide.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 mb-8 leading-relaxed">
              Discover pristine physical copies of award-winning fiction, memoirs, African history, and business bestsellers. Delivery costs are shown clearly at checkout, with tracking updates when available.
            </p>

            {/* Value Props Bar */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-800/80 max-w-xl">
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">100%</div>
                <div className="text-xs text-zinc-400 font-medium">Original Editions</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">36 States</div>
                <div className="text-xs text-zinc-400 font-medium">Zone Shipping Rates</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-sky-400">Updates</div>
                <div className="text-xs text-zinc-400 font-medium">Dispatched by Email</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Marketplace Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Catalog controls */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Bottom Row: Category Pills & Sort */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-zinc-800/60">
            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category.name
                      ? "bg-zinc-800 text-zinc-100 border border-zinc-700 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Sort & Sync Controls */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort books catalog"
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-700"
                >
                  <option value="featured">Featured First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>

              <button
                onClick={loadCatalog}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                title="Refresh Catalog"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-8">
            <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-200 mb-1">No books matched your criteria</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
              Try adjusting your search query or category filter to explore more titles.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedVendor("all");
                setSelectedCategory("All Categories");
              }}
              className="px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {paginatedBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        {!loading && filteredBooks.length > 0 && (
          <nav className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-5 border-t border-zinc-800/80" aria-label="Book catalog pagination">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-20 text-center text-xs text-zinc-300 font-mono">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090A0F] text-zinc-100" /> }>
      <MarketplacePageContent />
    </Suspense>
  );
}
