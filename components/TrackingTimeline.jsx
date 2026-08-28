import React from "react";
import { CheckCircle2, Circle, Clock, ShoppingCart, Truck, PackageCheck, AlertCircle } from "lucide-react";

const STAGES = [
  {
    key: "paid",
    label: "Payment Confirmed",
    description: "Paid upfront via Paystack",
    icon: CheckCircle2
  },
  {
    key: "ordered_from_vendor",
    label: "Sourced from Vendor",
    description: "Our team purchased from the vendor",
    icon: ShoppingCart
  },
  {
    key: "in_transit",
    label: "Vendor Dispatched",
    description: "Vendor dispatch details received",
    icon: Truck
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Package received by customer",
    icon: PackageCheck
  }
];

export default function TrackingTimeline({ status = "paid" }) {
  const getStageIndex = (s) => {
    switch (s) {
      case "paid":
        return 0;
      case "ordered_from_vendor":
        return 1;
      case "in_transit":
        return 2;
      case "delivered":
        return 3;
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(status);

  return (
    <div className="w-full py-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
        {STAGES.map((stage, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = stage.icon;

          return (
            <div
              key={stage.key}
              className={`relative flex flex-col p-3.5 rounded-xl border transition-all ${
                isCurrent
                  ? "bg-sky-950/30 border-sky-500/50 shadow-lg shadow-sky-500/10"
                  : isDone
                  ? "bg-zinc-900/60 border-emerald-500/30"
                  : "bg-zinc-900/20 border-zinc-800/60 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? "bg-sky-500 text-white animate-pulse"
                      : isDone
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="font-mono text-[11px] uppercase font-bold tracking-wider">
                  {isCurrent ? (
                    <span className="text-sky-400">Step {idx + 1} &bull; Active</span>
                  ) : isDone ? (
                    <span className="text-emerald-400">Step {idx + 1} &bull; Done</span>
                  ) : (
                    <span className="text-zinc-600">Step {idx + 1}</span>
                  )}
                </div>
              </div>

              <div className="text-xs font-bold text-zinc-100">{stage.label}</div>
              <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{stage.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
