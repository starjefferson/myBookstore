"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrder } from "../../lib/dataService";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/Toast";
import { ArrowLeft, BookOpen, CheckCircle2, Mail, Phone, Send } from "lucide-react";

export default function OrderRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    bookTitle: "",
    expectedAmount: "",
    fullName: user?.displayName || "",
    email: user?.email || "",
    phone: "",
    notes: ""
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.bookTitle.trim() || !formData.expectedAmount || !formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      showToast("Please complete all required request fields.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const request = await createOrder({
        orderType: "request",
        status: "order_requested",
        buyerId: user?.uid || `guest_${Date.now()}`,
        buyerName: formData.fullName.trim(),
        buyerEmail: formData.email.trim(),
        buyerPhone: formData.phone.trim(),
        requestedBookTitle: formData.bookTitle.trim(),
        expectedAmount: Number(formData.expectedAmount),
        customerNotes: formData.notes.trim(),
        items: [],
        totalPaid: 0
      });
      setSubmittedRequest(request);
      showToast("Your book request has been sent to our admin team.", "success");
    } catch (error) {
      console.error("Order request error:", error);
      showToast("Unable to send your request. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRequest) {
    return (
      <main className="min-h-screen bg-[#090A0F] text-zinc-100 px-4 py-16">
        <div className="max-w-xl mx-auto text-center bg-[#0F1117] border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">Request received</h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            We will review <span className="text-zinc-200 font-semibold">{submittedRequest.requestedBookTitle}</span> and contact you at {submittedRequest.buyerEmail} or {submittedRequest.buyerPhone} if we can complete the order.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/" className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold">Return to marketplace</Link>
            <button type="button" onClick={() => router.push("/dashboard")} className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-semibold">Track orders</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090A0F] text-zinc-100 py-10 sm:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-sky-400 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to marketplace
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-400 mb-3">
            <BookOpen className="w-3.5 h-3.5" /> Custom book request
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Place an order for any book</h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
            Can&apos;t find the title in our catalog or search? Send us the book you need anyway. Leave a working phone number and email so our admin team can contact you if the book can be sourced and the request can be completed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0F1117] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="bookTitle" className="block text-xs font-medium text-zinc-300 mb-1.5">Book title needed *</label>
              <input id="bookTitle" name="bookTitle" required value={formData.bookTitle} onChange={handleChange} placeholder="Enter the full book title" className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label htmlFor="expectedAmount" className="block text-xs font-medium text-zinc-300 mb-1.5">Expected amount (NGN) *</label>
              <input id="expectedAmount" name="expectedAmount" type="number" min="1" step="100" required value={formData.expectedAmount} onChange={handleChange} placeholder="e.g. 15000" className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-zinc-300 mb-1.5">Your name *</label>
              <input id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Full name" className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-300 mb-1.5">Email address *</label>
              <div className="relative"><Mail className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" /><input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="you@example.com" className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500" /></div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-zinc-300 mb-1.5">Phone number *</label>
              <div className="relative"><Phone className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" /><input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} placeholder="0800 000 0000" className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500" /></div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className="block text-xs font-medium text-zinc-300 mb-1.5">Extra details (optional)</label>
              <textarea id="notes" name="notes" rows="4" value={formData.notes} onChange={handleChange} placeholder="Author, edition, format, or any other details that may help us source it" className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 resize-y" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <Send className="w-4 h-4" /> {submitting ? "Sending request..." : "Send order request"}
          </button>
        </form>
      </div>
    </main>
  );
}
