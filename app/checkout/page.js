"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/Toast";
import { SHIPPING_ZONES, getZoneByState, formatNGN } from "../../lib/zones";
import { initializePaystackPayment } from "../../lib/paystack";
import { createOrder } from "../../lib/dataService";
import {
  ShieldCheck,
  Truck,
  CreditCard,
  ArrowLeft,
  Lock,
  CheckCircle2,
  MapPin,
  User,
  Phone,
  Mail,
  ShoppingBag,
  ExternalLink,
  Zap
} from "lucide-react";

export default function CheckoutPage() {
  const PENDING_PAYMENT_KEY = "concierge_pending_payment";
  const router = useRouter();
  const { items, subtotal, clearCart, totalItems } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    fullName: user?.displayName || "",
    email: user?.email || "",
    phone: "",
    address: "",
    state: "Lagos",
    notes: ""
  });

  const [selectedZone, setSelectedZone] = useState(getZoneByState("Lagos"));
  const [processing, setProcessing] = useState(false);
  const [paymentSuccessOrder, setPaymentSuccessOrder] = useState(null);
  const [confirmationError, setConfirmationError] = useState("");
  const pendingPaymentRef = useRef(null);
  const isConfirmingPayment = useRef(false);

  const shippingFee = selectedZone?.fee || 2000;
  const totalAmount = subtotal + shippingFee;

  // Track Meta Pixel & GA4 "InitiateCheckout" on page view
  useEffect(() => {
    if (items.length > 0 && typeof window !== "undefined") {
      if (window.fbq) {
        window.fbq("track", "InitiateCheckout", {
          content_ids: items.map((i) => i.id),
          num_items: totalItems,
          value: totalAmount,
          currency: "NGN",
        });
      }
      if (window.gtag) {
        window.gtag("event", "begin_checkout", {
          currency: "NGN",
          value: totalAmount,
          items: items.map((i) => ({
            id: i.id,
            name: i.title,
            price: i.retailPrice,
            quantity: i.quantity || 1,
          })),
        });
      }
    }
  }, [items.length, totalAmount, totalItems]);

  // Update zone when state changes
  useEffect(() => {
    const zone = getZoneByState(formData.state);
    setSelectedZone(zone);
  }, [formData.state]);

  // Pre-fill user data & load cached guest info from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedInfo = localStorage.getItem("guest_checkout_info");
      if (savedInfo) {
        try {
          const parsed = JSON.parse(savedInfo);
          setFormData((prev) => ({
            ...prev,
            ...parsed,
            fullName: user?.displayName || prev.fullName || parsed.fullName || "",
            email: user?.email || prev.email || parsed.email || ""
          }));
        } catch (err) {
          console.error("Failed to parse guest_checkout_info from localStorage", err);
        }
      } else if (user) {
        setFormData((prev) => ({
          ...prev,
          fullName: prev.fullName || user.displayName || "",
          email: prev.email || user.email || ""
        }));
      }
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (typeof window !== "undefined") {
        localStorage.setItem("guest_checkout_info", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const confirmPaymentAndCreateOrder = useCallback(async (pendingPayment) => {
    if (!pendingPayment || isConfirmingPayment.current) return;

    isConfirmingPayment.current = true;
    setProcessing(true);
    setConfirmationError("");

    try {
      const response = await fetch("/api/paystack/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingPayment)
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.order) {
        throw new Error(result.error || "We could not confirm your payment yet.");
      }

      const newOrder = await createOrder(result.order);

      // Fire Meta Pixel & GA4 Purchase Conversion Events
      if (typeof window !== "undefined") {
        if (window.fbq) {
          window.fbq("track", "Purchase", {
            value: newOrder.totalPaid || totalAmount,
            currency: "NGN",
            content_ids: (newOrder.items || []).map((i) => i.bookId || i.id),
            content_type: "product",
            num_items: (newOrder.items || []).length,
          });
        }
        if (window.gtag) {
          window.gtag("event", "purchase", {
            transaction_id: newOrder.paymentReference || newOrder.id,
            value: newOrder.totalPaid || totalAmount,
            currency: "NGN",
            items: (newOrder.items || []).map((i) => ({
              id: i.bookId || i.id,
              name: i.title,
              price: i.retailPrice,
              quantity: i.quantity || 1,
            })),
          });
        }
      }

      clearCart();
      if (typeof window !== "undefined") {
        localStorage.removeItem("guest_checkout_info");
        localStorage.removeItem(PENDING_PAYMENT_KEY);
      }
      pendingPaymentRef.current = null;
      setPaymentSuccessOrder(newOrder);
      showToast("Payment confirmed! Your order has been received.", "success");
    } catch (err) {
      console.error("Payment confirmation error:", err);
      setConfirmationError(err.message || "Your payment is awaiting confirmation.");
      showToast("Your payment was approved. Please retry confirmation; your order will not be duplicated.", "info");
    } finally {
      isConfirmingPayment.current = false;
      setProcessing(false);
    }
  }, [clearCart, showToast, totalAmount]);

  // Check for interrupted/pending payments on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedPayment = JSON.parse(localStorage.getItem(PENDING_PAYMENT_KEY));
      if (savedPayment?.reference && savedPayment?.order) {
        pendingPaymentRef.current = savedPayment;
        confirmPaymentAndCreateOrder(savedPayment);
      }
    } catch (err) {
      console.error("Failed to restore pending payment confirmation", err);
    }
  }, [confirmPaymentAndCreateOrder]);

  const handlePayNow = async (e) => {
    e.preventDefault();

    if (items.length === 0) {
      showToast("Your cart is empty. Add a book to checkout.", "error");
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone || !formData.address) {
      showToast("Please fill in all required shipping fields.", "error");
      return;
    }

    setProcessing(true);

    const reference = `PS_CONCIERGE_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await initializePaystackPayment({
        email: formData.email,
        amount: totalAmount,
        reference: reference,
        metadata: {
          buyerName: formData.fullName,
          buyerPhone: formData.phone,
          shippingAddress: formData.address,
          destinationState: formData.state,
          zoneTier: selectedZone?.tier || 1,
          itemsCount: items.length
        },
        onSuccess: async (response) => {
          const paymentReference = response.reference || reference;
          const order = {
            id: `ORD-${paymentReference.replace(/[^a-zA-Z0-9_-]/g, "")}`,
            buyerId: user?.uid || `guest_${Date.now()}`,
            buyerEmail: formData.email,
            buyerName: formData.fullName,
            buyerPhone: formData.phone,
            items: items.map((item) => ({
              bookId: item.id,
              title: item.title,
              quantity: item.quantity || 1,
              retailPrice: item.retailPrice,
              vendorPrice: item.vendorPrice || item.retailPrice,
              sourceVendor: item.sourceVendor || "masobe",
              sourceUrl: item.sourceUrl || ""
            })),
            shippingAddress: formData.address,
            destinationState: formData.state,
            shippingZoneTier: selectedZone?.tier || 1,
            bookSubtotal: subtotal,
            shippingFee: shippingFee,
            totalPaid: totalAmount,
            paymentReference,
            status: "paid",
            courierName: "",
            trackingNumber: "",
            customerNotes: formData.notes
          };
          const pendingPayment = { reference: paymentReference, order };
          pendingPaymentRef.current = pendingPayment;
          if (typeof window !== "undefined") {
            localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pendingPayment));
          }
          await confirmPaymentAndCreateOrder(pendingPayment);
        },
        onCancel: () => {
          setProcessing(false);
          showToast("Payment was cancelled. You have not been charged.", "info");
        },
        onError: (err) => {
          setProcessing(false);
          showToast(err?.message || "Payment transaction failed", "error");
        }
      });
    } catch (err) {
      setProcessing(false);
      showToast(err.message || "Failed to launch Paystack checkout", "error");
    }
  };

  if (paymentSuccessOrder) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-16 px-4">
        <div className="max-w-xl mx-auto bg-[#0F1117] border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="text-xs font-mono uppercase font-bold text-emerald-400 tracking-wider">
            Payment Confirmed &bull; Order Logged
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 mt-2 mb-3">
            Thank you, {paymentSuccessOrder.buyerName}!
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            Your payment of <strong className="text-emerald-400 font-mono">{formatNGN(paymentSuccessOrder.totalPaid)}</strong> was successfully verified via Paystack. Our concierge admin has received the notification and is sourcing your items directly from the publishers.
          </p>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 mb-8 text-left text-xs font-mono space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">Order ID:</span>
              <span className="text-zinc-200 font-bold">#{paymentSuccessOrder.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Paystack Ref:</span>
              <span className="text-zinc-300 truncate max-w-[200px]">{paymentSuccessOrder.paymentReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Destination:</span>
              <span className="text-zinc-300">{paymentSuccessOrder.destinationState}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Status:</span>
              <span className="text-sky-400 font-bold uppercase">{paymentSuccessOrder.status}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <span>Track in Buyer Dashboard</span>
              <Truck className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-sm font-medium transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-sky-400 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Shipping Details Form */}
          <div className="lg:col-span-7 bg-[#0F1117] border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-100">Shipping & Delivery Details</h1>
                <p className="text-xs text-zinc-400">
                  Zone-based shipping rates across all 36 Nigerian states & FCT
                </p>
              </div>
            </div>

            <form id="checkout-form" onSubmit={handlePayNow} className="space-y-5">
              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Full Recipient Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      name="fullName"
                      required
                      placeholder="e.g. Chimamanda Adichie"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Phone Number (for Courier) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="0803 123 4567"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Email Address (for Waybill & Tracking updates) *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="buyer@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* State & Shipping Zone Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Destination State (Dynamic Zone Calculation) *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 transition-colors appearance-none cursor-pointer"
                  >
                    {SHIPPING_ZONES.map((zone) => (
                      <option key={zone.state} value={zone.state}>
                        {zone.state} — Tier {zone.tier} ({formatNGN(zone.fee)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zone Fee Indicator Banner */}
              {selectedZone && (
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold">
                      Tier {selectedZone.tier}
                    </span>
                    <span className="text-zinc-300">
                      Estimated delivery: <strong>{selectedZone.estimatedDays}</strong>
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatNGN(selectedZone.fee)}
                  </span>
                </div>
              )}

              {/* Street Address */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Street Address / House Number / Landmark *
                </label>
                <textarea
                  name="address"
                  required
                  rows={3}
                  placeholder="e.g. 14 Admiralty Way, Opp. Domino's Pizza, Lekki Phase 1"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                />
              </div>

              {/* Delivery Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Special Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  name="notes"
                  placeholder="e.g. Call my gate security if unreachable"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </form>
          </div>

          {/* Right: Order Summary & Paystack Action */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0F1117] border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-sky-400" />
                  <span>Order Summary ({totalItems})</span>
                </h3>
              </div>

              {/* Items List */}
              {items.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Your cart is currently empty.
                  <Link href="/" className="block text-sky-400 font-medium mt-2">
                    Browse Books
                  </Link>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-3 pr-1 mb-6">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60 text-xs"
                    >
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-10 h-14 object-cover rounded-lg bg-zinc-800 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {item.sourceVendor}
                        </span>
                        <div className="font-semibold text-zinc-200 truncate mt-0.5">{item.title}</div>
                        <div className="text-zinc-500 text-[11px]">Qty: {item.quantity}</div>
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0">
                        {formatNGN(item.retailPrice * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-2.5 pt-4 border-t border-zinc-800 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Books Subtotal</span>
                  <span className="font-mono text-zinc-200 font-semibold">{formatNGN(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    Zone Shipping ({formData.state} &bull; Tier {selectedZone?.tier})
                  </span>
                  <span className="font-mono text-zinc-200 font-semibold">{formatNGN(shippingFee)}</span>
                </div>
                <div className="pt-3 border-t border-zinc-800 flex justify-between items-baseline text-base font-bold text-zinc-100">
                  <span>Total Amount</span>
                  <span className="text-2xl font-mono text-emerald-400">{formatNGN(totalAmount)}</span>
                </div>
              </div>

              {/* Paystack Inline CTA Button */}
              {confirmationError && (
                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
                  <p>{confirmationError}</p>
                  <button
                    type="button"
                    onClick={() => confirmPaymentAndCreateOrder(pendingPaymentRef.current)}
                    className="mt-2 font-semibold text-sky-300 hover:text-sky-200"
                  >
                    Retry payment confirmation
                  </button>
                </div>
              )}
              <button
                type="submit"
                form="checkout-form"
                disabled={processing || items.length === 0}
                className="w-full mt-6 py-3.5 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <span>Initializing Secure Paystack...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay with Paystack &bull; {formatNGN(totalAmount)}</span>
                  </>
                )}
              </button>

              {/* Guarantee badge */}
              <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>256-Bit SSL Encrypted &bull; Direct Platform Settlement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}