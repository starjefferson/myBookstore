import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // 1. Verify secret token to block unauthorized cache purges
    if (!secret || secret !== process.env.REVALIDATION_SECRET_TOKEN) {
      return NextResponse.json({ error: "Invalid revalidation secret token" }, { status: 401 });
    }

    // 2. Purge Next.js Data Cache tags for catalog and metadata
    revalidateTag("catalog");
    revalidateTag("books");
    revalidateTag("catalogMeta");

    // 3. Purge route path layouts
    revalidatePath("/api/catalog");
    revalidatePath("/api/catalogVersion");
    revalidatePath("/", "layout");

    console.log("✓ Next.js CDN Edge, Layouts, and Data Caches purged successfully via Webhook.");

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      message: "Catalog API, Version Meta, and UI cache invalidated successfully.",
    });
  } catch (error) {
    console.error("Revalidation endpoint error:", error);
    return NextResponse.json({ error: "Failed to revalidate catalog cache" }, { status: 500 });
  }
}