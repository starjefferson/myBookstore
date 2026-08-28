"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { fetchOrders } from "../../lib/dataService";
import { formatNGN } from "../../lib/zones";
import TrackingTimeline from "../../components/TrackingTimeline";
import { useToast } from "../../components/Toast";
import {
  Package,
  Truck,
  Copy,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
  User,
  ShieldCheck
} from "lucide-react";

export default function BuyerDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchOrders(user?.email || null);
      setOrders(data);
      if (data.length > 0) {
        setSelectedOrder(data[0]);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    const handleOrderCreated = () => loadOrders();
    const handleOrderUpdated = () => loadOrders();
    window.addEventListener("order_created", handleOrderCreated);
    window.addEventListener("order_updated", handleOrderUpdated);

    return () => {
      window.removeEventListener("order_created", handleOrderCreated);
      window.removeEventListener("order_updated", handleOrderUpdated);
    };
  }, [user]);

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard`, "info");
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-zinc-800/80 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-400 mb-2">
              <Package className="w-3.5 h-3.5" />
              <span>Buyer Order Updates</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">
              Welcome back, {user?.displayName || user?.email?.split("@")[0] || "Reader"}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Your purchase status, vendor dispatch updates, and order history
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-colors flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Explore Marketplace</span>
            </Link>
          </div>
        </div>

        {/* Content Layout */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500 animate-pulse">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="bg-[#0F1117] border border-zinc-800 rounded-3xl p-12 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-500">
              <Package className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-zinc-200 mb-1">No Orders Found</h2>
            <p className="text-xs text-zinc-400 mb-6 max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Browse our curated bookstore to order and track in real-time.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400 transition-colors"
            >
              <span>Browse Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Orders List */}
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Order History ({orders.length})
              </h2>

              <div className="space-y-3">
                {orders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  const isDelivered = order.status === "delivered";
                  const isInTransit = order.status === "in_transit";
                  const isSourced = order.status === "ordered_from_vendor";

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-zinc-900/90 border-sky-500 shadow-lg shadow-sky-500/10"
                          : "bg-[#0F1117] border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-xs text-zinc-200">
                          #{order.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                            isDelivered
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/30"
                              : isInTransit
                              ? "bg-sky-950/60 text-sky-300 border-sky-500/30 animate-pulse"
                              : isSourced
                              ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700"
                          }`}
                        >
                          {order.status?.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-400 line-clamp-1 mb-2 font-medium">
                        {order.items?.map((i) => `${i.title} (${i.quantity}x)`).join(", ")}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/80">
                        <span className="text-zinc-500 font-mono">
                          {new Date(order.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatNGN(order.totalPaid)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected order details and vendor dispatch update */}
            {selectedOrder && (
              <div className="lg:col-span-7 space-y-6">
                {/* Status & Timeline Card */}
                <div className="bg-[#0F1117] border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-zinc-500">
                        Order Details & Dispatch Update
                      </span>
                      <h2 className="text-xl font-extrabold text-zinc-100 font-mono">
                        Order #{selectedOrder.id}
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-400 font-mono">Total Paid</div>
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {formatNGN(selectedOrder.totalPaid)}
                      </div>
                    </div>
                  </div>

                  {/* Visual Status Progress */}
                  <div className="my-4">
                    <TrackingTimeline status={selectedOrder.status} />
                  </div>

                  {/* Waybill / Courier Details Box */}
                  {selectedOrder.trackingNumber ? (
                    <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/40 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] uppercase font-bold text-sky-400 tracking-wider">
                            Courier: {selectedOrder.courierName || "Verified Courier"}
                          </div>
                          <div className="font-mono text-sm font-bold text-zinc-100 tracking-wider flex items-center gap-2">
                            <span>{selectedOrder.trackingNumber}</span>
                            <button
                              onClick={() =>
                                copyToClipboard(selectedOrder.trackingNumber, "Tracking Number")
                              }
                              className="text-zinc-400 hover:text-white"
                              title="Copy Tracking Number"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-400 text-right">
                        <span className="inline-block px-2.5 py-1 rounded bg-sky-500/10 text-sky-300 font-mono">
                          Vendor Dispatch Details
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 mt-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Our team is purchasing your books from the vendor. If the vendor provides dispatch details, we&apos;ll email them to <strong>{selectedOrder.buyerEmail}</strong>.
                      </span>
                    </div>
                  )}

                  {/* Package Items & Address breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-zinc-800 text-xs">
                    {/* Destination Address */}
                    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                      <h4 className="font-semibold text-zinc-200 uppercase tracking-wider mb-2 text-[11px]">
                        Destination Address
                      </h4>
                      <div className="text-zinc-300 font-medium">{selectedOrder.buyerName}</div>
                      <div className="text-zinc-400 mt-1">{selectedOrder.shippingAddress}</div>
                      <div className="text-zinc-400">{selectedOrder.destinationState}, Nigeria</div>
                      <div className="text-zinc-500 mt-1 font-mono">{selectedOrder.buyerPhone}</div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-1.5 font-mono">
                      <h4 className="font-semibold text-zinc-200 uppercase tracking-wider mb-2 text-[11px] font-sans">
                        Payment Breakdown
                      </h4>
                      <div className="flex justify-between text-zinc-400">
                        <span>Items Subtotal:</span>
                        <span>{formatNGN(selectedOrder.bookSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Zone Shipping ({selectedOrder.destinationState}):</span>
                        <span>{formatNGN(selectedOrder.shippingFee)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-200 font-bold pt-2 border-t border-zinc-800">
                        <span>Total Settle:</span>
                        <span className="text-emerald-400">{formatNGN(selectedOrder.totalPaid)}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate pt-1">
                        Ref: {selectedOrder.paymentReference}
                      </div>
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 font-mono">
                      Ordered Books ({selectedOrder.items?.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedOrder.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs"
                        >
                          <div>
                            <div className="font-bold text-zinc-100">{item.title}</div>
                            <div className="text-zinc-400 text-[11px]">
                              Qty: {item.quantity} &bull; Sourced from:{" "}
                              <span className="uppercase font-mono text-sky-400">
                                {item.sourceVendor}
                              </span>
                            </div>
                          </div>
                          <div className="font-mono font-bold text-emerald-400">
                            {formatNGN(item.retailPrice * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
