import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const getAdminDb = () => {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return null;
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY
            .trim()
            .replace(/^['"]|['"]$/g, "")
            .replace(/\\n/g, "\n")
        })
      });

  return getFirestore(app);
};

let catalogCache = null;
let catalogCacheVersion = null;

// Force dynamic execution to prevent build-time prerendering errors with request URL parameters
export const dynamic = "force-dynamic";

// Cache for 3.5 days (84 hours / 302,400,000 ms) to align with twice-weekly syncs (Mon/Thu 02:00 UTC)
const CATALOG_CACHE_TTL = 3.5 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("id");

    // Single book lookup by ID
    if (bookId) {
      const book = await db.collection("books").doc(bookId).get();
      return book.exists
        ? NextResponse.json({ id: book.id, ...book.data() })
        : NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Catalog-wide request with 3.5-day (84-hour) cache revalidation
    const version = searchParams.get("version") || "current";
    const cacheIsFresh = catalogCache && Date.now() - catalogCache.createdAt < CATALOG_CACHE_TTL;

    if (cacheIsFresh && catalogCacheVersion === version) {
      return NextResponse.json(catalogCache.books, {
        headers: {
          "Cache-Control": "public, s-maxage=302400, stale-while-revalidate=86400"
        }
      });
    }

    const snapshot = await db.collection("books").get();
    const books = snapshot.docs.map((book) => ({ id: book.id, ...book.data() }));

    catalogCache = { books, createdAt: Date.now() };
    catalogCacheVersion = version;

    return NextResponse.json(books, {
      headers: {
        "Cache-Control": "public, s-maxage=302400, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    console.error("Catalog API error:", error);
    return NextResponse.json({ error: "Unable to load catalog from Firestore" }, { status: 500 });
  }
}