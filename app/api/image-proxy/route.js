import { NextResponse } from "next/server";
import { generateBookCoverSvg } from "../../../lib/coverGenerator";

export const dynamic = "force-dynamic";

function getFallbackCoverResponse({ title, author, category }) {
  const svg = generateBookCoverSvg({
    title: title || "Book Title",
    author: author || "Author",
    category: category || "General",
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
    },
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  const title = searchParams.get("title") || "";
  const author = searchParams.get("author") || "";
  const category = searchParams.get("category") || "";

  if (!imageUrl) {
    return getFallbackCoverResponse({ title, author, category });
  }

  // Basic validation — only proxy http/https URLs
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return getFallbackCoverResponse({ title, author, category });
    }
  } catch {
    return getFallbackCoverResponse({ title, author, category });
  }

  // Derive vendor origin for Referer to bypass WordPress / LiteSpeed / Cloudflare hotlink protection
  const vendorOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;

  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(5000), // 5-second max timeout so page load never hangs
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
        Referer: `${vendorOrigin}/`,
      },
    });

    if (!response.ok) {
      console.warn(
        `[image-proxy] Upstream returned status ${response.status} for ${imageUrl}. Serving styled cover.`
      );
      return getFallbackCoverResponse({ title, author, category });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    // If upstream unexpectedly returned HTML (e.g. Cloudflare challenge or 404 page)
    if (contentType.includes("text/html")) {
      console.warn(`[image-proxy] Upstream returned HTML instead of image. Serving styled cover.`);
      return getFallbackCoverResponse({ title, author, category });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache for 7 days on Vercel Edge CDN + 7 days stale-while-revalidate
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.warn(`[image-proxy] Error fetching ${imageUrl}: ${err.message}. Serving styled cover.`);
    return getFallbackCoverResponse({ title, author, category });
  }
}
