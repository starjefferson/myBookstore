import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // 1. Verify secret token to block unauthorized cache purges
    if (!secret || secret !== process.env.REVALIDATION_SECRET_TOKEN) {
      return NextResponse.json({ error: "Invalid revalidation secret token" }, { status: 401 });
    }

    // 2. Purge Next.js CDN Edge Cache for the catalog API and storefront homepage
    revalidatePath("/api/catalog");
    revalidatePath("/");

    console.log("✓ Next.js CDN Edge Cache purged successfully via Webhook.");

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      message: "Catalog API cache invalidated successfully.",
    });
  } catch (error) {
    console.error("Revalidation endpoint error:", error);
    return NextResponse.json({ error: "Failed to revalidate catalog cache" }, { status: 500 });
  }
}