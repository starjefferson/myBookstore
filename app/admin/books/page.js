"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchBooks, saveBook } from "../../../lib/dataService";
import { formatNGN } from "../../../lib/zones";
import { useToast } from "../../../components/Toast";
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Edit2,
  ExternalLink,
  RotateCw,
  Save,
  X,
  Search,
  CheckCircle2,
  TrendingUp,
  Layers
} from "lucide-react";

export default function AdminBooksPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingBook, setEditingBook] = useState(null);
  const [isNewBook, setIsNewBook] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await fetchBooks();
      setBooks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleSaveBook = async (e) => {
    e.preventDefault();
    try {
      await saveBook(editingBook);
      showToast(`Book "${editingBook.title}" saved successfully!`, "success");
      setEditingBook(null);
      setIsNewBook(false);
      loadCatalog();
    } catch (err) {
      showToast("Error saving book", "error");
    }
  };

  const openNewBookModal = () => {
    setIsNewBook(true);
    setEditingBook({
      id: `bk-${Date.now()}`,
      title: "",
      author: "",
      description: "",
      coverImage: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800",
      vendorPrice: 5000,
      retailPrice: 6500,
      sourceVendor: "masobe",
      sourceUrl: "",
      category: "Fiction",
      inStock: true,
      rating: 4.8
    });
  };

  const filtered = books.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-sky-400 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Order Operations</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-zinc-800 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-400 mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Catalog & Markup Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">
              Dropshipped Book Inventory ({books.length})
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Adjust retail pricing margins, add publisher links, or register new scraped books.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openNewBookModal}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dropship Book</span>
            </button>
            <button
              onClick={loadCatalog}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 max-w-sm">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search catalog titles or authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Books Table */}
        <div className="bg-[#0F1117] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px]">
                  <th className="py-3.5 px-4">Book Title & Author</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Retail Price</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((book) => {
                  return (
                    <tr key={book.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img
                          src={book.coverImage}
                          alt={book.title}
                          className="w-8 h-12 object-cover rounded bg-zinc-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-100 truncate max-w-xs">{book.title}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{book.author}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`uppercase font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                            book.sourceVendor === "masobe"
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                              : "bg-sky-950/60 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {book.sourceVendor}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {formatNGN(book.retailPrice)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setIsNewBook(false);
                            setEditingBook(book);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit / New Book Modal */}
        {editingBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-[#0F1117] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setEditingBook(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-zinc-100 mb-4">
                {isNewBook ? "Add New Dropship Book" : "Edit Book & Pricing"}
              </h3>

              <form onSubmit={handleSaveBook} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Book Title *</label>
                  <input
                    type="text"
                    required
                    value={editingBook.title}
                    onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Author Name *</label>
                  <input
                    type="text"
                    required
                    value={editingBook.author}
                    onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Source Vendor *</label>
                    <select
                      value={editingBook.sourceVendor}
                      onChange={(e) =>
                        setEditingBook({ ...editingBook, sourceVendor: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="masobe">Masobe Books</option>
                      <option value="rovingheights">Rovingheights</option>
                      <option value="retala">Retala (retala.com.ng)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Category</label>
                    <input
                      type="text"
                      value={editingBook.category || "Fiction"}
                      onChange={(e) =>
                        setEditingBook({ ...editingBook, category: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1 font-medium">Retail Price (NGN) *</label>
                    <input
                      type="number"
                      required
                      value={editingBook.retailPrice}
                      onChange={(e) =>
                        setEditingBook({ ...editingBook, retailPrice: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-emerald-400 font-bold focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Cover Image URL</label>
                  <input
                    type="url"
                    value={editingBook.coverImage}
                    onChange={(e) =>
                      setEditingBook({ ...editingBook, coverImage: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Publisher Source URL</label>
                  <input
                    type="url"
                    value={editingBook.sourceUrl || ""}
                    placeholder="https://masobebooks.com/shop/..."
                    onChange={(e) =>
                      setEditingBook({ ...editingBook, sourceUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Description</label>
                  <textarea
                    rows={3}
                    value={editingBook.description || ""}
                    onChange={(e) =>
                      setEditingBook({ ...editingBook, description: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-sky-500 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Book Record</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
