import React from "react";

export default function SkeletonCard() {
  return (
    <div className="bg-[#0F1117] border border-zinc-800/80 rounded-2xl overflow-hidden animate-pulse flex flex-col h-full">
      {/* Image Skeleton */}
      <div className="relative w-full pt-[135%] bg-zinc-800/60" />
      
      {/* Body Skeleton */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          {/* Vendor Badge & Category */}
          <div className="flex items-center justify-between mb-2">
            <div className="w-20 h-4 bg-zinc-800 rounded-full" />
            <div className="w-14 h-3 bg-zinc-800/60 rounded" />
          </div>
          
          {/* Title & Author */}
          <div className="w-3/4 h-5 bg-zinc-800 rounded mb-2" />
          <div className="w-1/2 h-3.5 bg-zinc-800/70 rounded" />
        </div>

        {/* Price & Action Button */}
        <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
          <div className="w-20 h-6 bg-zinc-800 rounded" />
          <div className="w-24 h-9 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
