import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";

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

// Force dynamic execution to prevent build-time prerendering errors with request URL parameters
export const dynamic = "force-dynamic";

/**
 * Next.js Tagged Data Cache wrapper.
 * Responds to revalidateTag("catalog") and revalidateTag("books") in /api/revalidate.
 */
const getCachedCatalog = unstable_cache(
  async () => {
    const db = getAdminDb();
    if (!db) return null;

    const snapshot = await db.collection("books").get();
    return snapshot.docs.map((book) => ({ id: book.id, ...book.data() }));
  },
  ["full-catalog-list"],
  {
    revalidate: 302400, // 3.5 days fallback TTL
    tags: ["catalog", "books"],
  }
);

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

    // Fetch catalog via Next.js Data Cache
    const books = await getCachedCatalog();

    if (!books) {
      return NextResponse.json({ error: "Unable to load catalog from Firestore" }, { status: 500 });
    }

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