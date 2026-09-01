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

export const dynamic = "force-dynamic";

const CATALOG_CACHE_TTL = 3 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const bookId = new URL(request.url).searchParams.get("id");
    if (bookId) {
      const book = await db.collection("books").doc(bookId).get();
      return book.exists
        ? NextResponse.json({ id: book.id, ...book.data() })
        : NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const version = new URL(request.url).searchParams.get("version") || "current";
    const cacheIsFresh = catalogCache && Date.now() - catalogCache.createdAt < CATALOG_CACHE_TTL;
    if (cacheIsFresh && catalogCacheVersion === version) {
      return NextResponse.json(catalogCache.books, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const snapshot = await db.collection("books").get();
    const books = snapshot.docs.map((book) => ({ id: book.id, ...book.data() }));
    catalogCache = { books, createdAt: Date.now() };
    catalogCacheVersion = version;
    return NextResponse.json(books, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Catalog API error:", error);
    return NextResponse.json({ error: "Unable to load catalog from Firestore" }, { status: 500 });
  }
}