import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // Basic validation — only proxy http/https URLs
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        // Omitting Referer bypasses hotlink protection on vendor servers (rhbooks, masobe, etc.)
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream image fetch failed: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        // Cache for 7 days on Vercel's edge — aligns with the weekly scraper/catalog cycle.
        // Vercel only caches an image the first time it's requested; images never viewed
        // are never fetched. stale-while-revalidate allows a further 7-day grace window
        // where stale images are served instantly while a fresh copy is fetched in the background.
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("[image-proxy] fetch error:", err);
    return NextResponse.json({ error: "Image proxy error" }, { status: 500 });
  }
}
