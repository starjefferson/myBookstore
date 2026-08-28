"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { fetchOrders, updateOrderStatus } from "../../lib/dataService";
import { formatNGN } from "../../lib/zones";
import { useToast } from "../../components/Toast";
import {
  ShieldCheck,
  Package,
  Truck,
  ExternalLink,
  Clock,
  CheckCircle2,
  Send,
  ShoppingBag,
  User,
  MapPin,
  X,
  AlertCircle,
  RotateCw,
  Search,
  BookOpen,
  Lock,
  LogOut
} from "lucide-react";

export default function AdminPortalPage() {
  const { user, isAdmin, loginWithEmail, logout } = useAuth();
  const { showToast } = useToast();

  // Authentication Form States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Order Management States
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state for dispatching tracking
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [courierName, setCourierName] = useState("GIG Logistics");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const ADMIN_EMAILS = [
    process.env.NEXT_PUBLIC_ADMIN_EMAIL_1?.toLowerCase() || "admin@conciergebooks.ng",
    process.env.NEXT_PUBLIC_ADMIN_EMAIL_2?.toLowerCase() || "admin2@conciergebooks.ng"
  ];

  const loadAllOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load admin orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadAllOrders();

      const handleCreated = () => loadAllOrders();
      const handleUpdated = () => loadAllOrders();
      window.addEventListener("order_created", handleCreated);
      window.addEventListener("order_updated", handleUpdated);

      return () => {
        window.removeEventListener("order_created", handleCreated);
        window.removeEventListener("order_updated", handleUpdated);
      };
    }
  }, [user, isAdmin]);

  // Handle Firebase Admin Login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const signedInUser = await loginWithEmail(loginEmail, loginPassword);
      if (!ADMIN_EMAILS.includes(signedInUser.email?.toLowerCase())) {
        await logout();
        throw new Error("This Firebase account is not authorized to access the admin dashboard.");
      }
      showToast("Admin access authenticated successfully", "success");
    } catch (err) {
      console.error("Admin Login Error:", err);
      setAuthError(err.message || "Invalid administrator credentials");
      showToast("Authentication failed", "error");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Admin Sign Out
  const handleAdminLogout = async () => {
    try {
      await logout();
      showToast("Signed out of Admin Portal", "info");
    } catch (err) {
      showToast("Error signing out", "error");
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const gmv = orders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);
    const pendingSourcing = orders.filter((o) => o.status === "paid").length;
    const inTransit = orders.filter((o) => o.status === "in_transit").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    return { totalOrders, gmv, pendingSourcing, inTransit, delivered };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterStatus !== "all" && order.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = order.id?.toLowerCase().includes(q);
        const matchName = order.buyerName?.toLowerCase().includes(q);
        const matchEmail = order.buyerEmail?.toLowerCase().includes(q);
        const matchTrack = order.trackingNumber?.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchEmail && !matchTrack) return false;
      }
      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  // Handle Action: Sourced from vendor
  const handleMarkOrderedFromVendor = async (orderId) => {
    try {
      await updateOrderStatus(orderId, { status: "ordered_from_vendor" });
      showToast(`Order #${orderId} marked as Ordered from Vendor`, "info");
      loadAllOrders();
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  // Open Dispatch Modal
  const openDispatchModal = (order) => {
    setDispatchModalOrder(order);
    setCourierName(order.courierName || "GIG Logistics");
    setTrackingNumber(order.trackingNumber || `GIG-${Math.floor(10000000 + Math.random() * 90000000)}-NG`);
  };

  // Submit Dispatch & trigger Resend Email
  const handleConfirmDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchModalOrder || !trackingNumber.trim()) {
      showToast("Tracking Number is required", "error");
      return;
    }

    setSendingEmail(true);
    try {
      // 1. Update Firestore/Storage
      await updateOrderStatus(dispatchModalOrder.id, {
        status: "in_transit",
        courierName: courierName.trim(),
        trackingNumber: trackingNumber.trim()
      });

      // 2. Call API Route to trigger Resend
      const response = await fetch("/api/send-shipping-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: dispatchModalOrder.id,
          buyerName: dispatchModalOrder.buyerName,
          buyerEmail: dispatchModalOrder.buyerEmail,
          trackingNumber: trackingNumber.trim(),
          courierName: courierName.trim(),
          destinationState: dispatchModalOrder.destinationState,
          shippingAddress: dispatchModalOrder.shippingAddress,
          items: dispatchModalOrder.items,
          totalPaid: dispatchModalOrder.totalPaid
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Email API failed");
      }

      showToast(
        `Waybill updated! Automated tracking email sent to ${dispatchModalOrder.buyerEmail}`,
        "success"
      );
      setDispatchModalOrder(null);
      loadAllOrders();
    } catch (err) {
      console.error("Dispatch error:", err);
      showToast(`Status updated, but email alert error: ${err.message}`, "info");
      setDispatchModalOrder(null);
      loadAllOrders();
    } finally {
      setSendingEmail(false);
    }
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      await updateOrderStatus(orderId, { status: "delivered" });
      showToast(`Order #${orderId} marked as Delivered to customer!`, "success");
      loadAllOrders();
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  // ---------------------------------------------------------------------------
  // FIREBASE AUTHENTICATION GUARD (RESTRICTED ADMIN GATE)
  // ---------------------------------------------------------------------------
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0F1117] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Admin Access</h1>
              <p className="text-xs text-zinc-400">Restricted operational portal</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="admin@conciergebooks.ng"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full mt-2 py-3 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <span>Authenticating Admin...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In to Admin Portal</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PROTECTED ADMIN PORTAL DASHBOARD VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-zinc-800/80 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Order Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">
              Vendor Purchase Queue & Order Updates
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Purchase confirmed customer orders on Rovingheights or Retala, then share any vendor-provided dispatch update with the customer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/books"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Manage Catalog</span>
            </Link>

            <button
              onClick={loadAllOrders}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors"
              title="Refresh Orders"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleAdminLogout}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-rose-400 hover:text-rose-300 hover:border-rose-900/50 transition-colors"
              title="Sign Out of Admin Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#0F1117] border border-zinc-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1">Total GMV</div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {formatNGN(metrics.gmv)}
            </div>
          </div>
          <div className="bg-[#0F1117] border border-zinc-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-amber-400 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Needs Sourcing</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              {metrics.pendingSourcing}
            </div>
          </div>
          <div className="bg-[#0F1117] border border-zinc-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-sky-400 mb-1 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              <span>In Transit</span>
            </div>
            <div className="text-xl font-bold font-mono text-sky-300">
              {metrics.inTransit}
            </div>
          </div>
          <div className="bg-[#0F1117] border border-zinc-800 p-4 rounded-2xl">
            <div className="text-[11px] font-mono uppercase text-emerald-400 mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Delivered</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300">
              {metrics.delivered}
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto w-full sm:w-auto">
            {[
              { id: "all", label: "All Orders" },
              { id: "order_requested", label: "Order Requests" },
              { id: "paid", label: "Paid (Needs Sourcing)" },
              { id: "ordered_from_vendor", label: "Ordered from Vendor" },
              { id: "in_transit", label: "In Transit" },
              { id: "delivered", label: "Delivered" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterStatus === tab.id
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by buyer, order ID, or tracking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Manual vendor-purchase queue */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs animate-pulse">Loading incoming orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-[#0F1117] border border-zinc-800 rounded-3xl p-12 text-center">
            <Package className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-zinc-300">No orders matching this view</h3>
            <p className="text-xs text-zinc-500 mt-1">Orders placed by buyers will appear here in real-time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isRequest = order.orderType === "request" || order.status === "order_requested";
              const isPaid = order.status === "paid";
              const isOrdered = order.status === "ordered_from_vendor";
              const isInTransit = order.status === "in_transit";
              const isDelivered = order.status === "delivered";

              return (
                <div
                  key={order.id}
                  className="bg-[#0F1117] border border-zinc-800/90 rounded-2xl p-5 sm:p-6 transition-all hover:border-zinc-700 space-y-4"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-zinc-100">
                        #{order.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          isDelivered
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/30"
                            : isInTransit
                            ? "bg-sky-950/60 text-sky-300 border-sky-500/30 animate-pulse"
                            : isOrdered
                            ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                            : "bg-rose-950/60 text-rose-300 border-rose-500/30 font-bold"
                        }`}
                      >
                        {order.status?.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {new Date(order.createdAt).toLocaleString("en-GB", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 font-mono">{isRequest ? "Expected Amount:" : "Settled Amount:"}</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        {formatNGN(isRequest ? order.expectedAmount : order.totalPaid)}
                      </span>
                    </div>
                  </div>

                  {/* Body Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Buyer & Destination Details */}
                    <div className="md:col-span-4 space-y-2 text-xs">
                      <div className="text-zinc-500 uppercase font-mono text-[10px]">
                        Buyer & Shipping Info
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                        <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-sky-400" />
                          <span>{order.buyerName}</span>
                        </div>
                        <div className="text-zinc-400">{order.buyerEmail}</div>
                        <div className="text-zinc-400 font-mono">{order.buyerPhone}</div>
                        <div className="pt-2 border-t border-zinc-800 text-zinc-300">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
                          <span>{order.shippingAddress}</span>
                          <div className="font-bold text-zinc-200 mt-0.5">
                            {order.destinationState} &bull; Zone Tier {order.shippingZoneTier || 1}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ordered Items & Direct Publisher Purchase Links */}
                    <div className="md:col-span-5 space-y-2 text-xs">
                      <div className="text-zinc-500 uppercase font-mono text-[10px]">
                        {isRequest ? "Requested Book" : "Books to Purchase from Vendor"}
                      </div>
                      {isRequest ? (
                        <div className="p-3 rounded-xl bg-zinc-900/60 border border-amber-500/20 space-y-1">
                          <div className="font-bold text-zinc-100">{order.requestedBookTitle}</div>
                          {order.customerNotes && <div className="text-zinc-400">{order.customerNotes}</div>}
                        </div>
                      ) : <div className="space-y-2">
                        {order.items?.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-zinc-100 truncate">{item.title}</div>
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                                <span>Qty: {item.quantity}</span>
                                <span>&bull;</span>
                                <span
                                  className={`uppercase font-mono font-bold ${
                                    item.sourceVendor === "masobe"
                                      ? "text-emerald-400"
                                      : "text-sky-400"
                                  }`}
                                >
                                  {item.sourceVendor}
                                </span>
                              </div>
                            </div>

                            {/* Direct Purchase Link on Vendor Site */}
                            {item.sourceUrl ? (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                                title="Open publisher store to buy with buyer's address"
                              >
                                <span>Buy on Vendor</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-zinc-500">No vendor link</span>
                            )}
                          </div>
                        ))}
                      </div>}
                    </div>

                    {/* Manual order-operation controls */}
                    <div className="md:col-span-3 space-y-2 text-xs flex flex-col justify-between">
                      <div className="text-zinc-500 uppercase font-mono text-[10px]">
                        Concierge Actions
                      </div>

                      <div className="space-y-2">
                        {/* Step 1: Mark Ordered */}
                        {isPaid && (
                          <button
                            onClick={() => handleMarkOrderedFromVendor(order.id)}
                            className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>1. Mark Ordered on Vendor</span>
                          </button>
                        )}

                        {/* Step 2: Input Tracking & Dispatch Email */}
                        {(isPaid || isOrdered || isInTransit) && (
                          <button
                            onClick={() => openDispatchModal(order)}
                            className="w-full py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isInTransit ? "Update Waybill / Resend" : "2. Dispatch & Send Waybill"}</span>
                          </button>
                        )}

                        {/* Step 3: Mark Delivered */}
                        {isInTransit && (
                          <button
                            onClick={() => handleMarkDelivered(order.id)}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>3. Mark Delivered</span>
                          </button>
                        )}

                        {isDelivered && (
                          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-center font-bold text-[11px] flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Order Completed</span>
                          </div>
                        )}
                      </div>

                      {/* Waybill preview if present */}
                      {order.trackingNumber && (
                        <div className="pt-2 text-[11px] text-zinc-400 font-mono">
                          <span className="text-zinc-500">Waybill:</span> {order.courierName} &bull;{" "}
                          <span className="text-sky-300">{order.trackingNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Dispatch Tracking & Resend Email */}
        {dispatchModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-[#0F1117] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">
                    Add Vendor Dispatch Update
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Order #{dispatchModalOrder.id} &bull; {dispatchModalOrder.buyerName}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-5 leading-relaxed">
                Add the dispatch details supplied by the vendor. This will set the order to{" "}
                <strong className="text-sky-400">&apos;in_transit&apos;</strong> and trigger a branded
                delivery notification email to{" "}
                <strong className="text-zinc-200">{dispatchModalOrder.buyerEmail}</strong> via Resend API.
              </div>

              <form onSubmit={handleConfirmDispatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Courier Partner Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GIG Logistics, DHL, Fez Delivery, Speedaf"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Waybill / Tracking Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GIG-89421190-NG"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {sendingEmail ? (
                      <span>Sending Resend Email & Updating...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Confirm Dispatch & Send Email</span>
                      </>
                    )}
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
