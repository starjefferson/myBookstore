import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";

const getAdminDb = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin Environment Variables");
    return null;
  }

  const formattedPrivateKey = privateKey
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n");

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });

  return getFirestore(app);
};

export const dynamic = "force-dynamic";

/**
 * Next.js Tagged Data Cache wrapper.
 * Sanitizes Firestore documents into plain JSON before caching to prevent serialization errors.
 */
const getCachedCatalog = unstable_cache(
  async () => {
    const db = getAdminDb();
    if (!db) {
      throw new Error("Firebase Admin SDK failed to initialize. Check environment variables.");
    }

    const snapshot = await db.collection("books").get();

    // Convert Firestore DocumentData and Timestamps into plain JSON primitives
    const rawBooks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return JSON.parse(JSON.stringify(rawBooks));
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
      return NextResponse.json(
        { error: "Firebase Admin is not configured on Vercel" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("id");

    // Single book lookup by ID
    if (bookId) {
      const book = await db.collection("books").doc(bookId).get();
      if (!book.exists) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }
      return NextResponse.json(
        JSON.parse(JSON.stringify({ id: book.id, ...book.data() }))
      );
    }

    // Fetch catalog via Next.js Data Cache
    const books = await getCachedCatalog();

    if (!books) {
      return NextResponse.json(
        { error: "Unable to load catalog from Firestore" },
        { status: 500 }
      );
    }

    return NextResponse.json(books, {
      headers: {
        "Cache-Control": "public, s-maxage=302400, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Catalog API Error Trace:", error?.stack || error);
    return NextResponse.json(
      { error: "Unable to load catalog from Firestore" },
      { status: 500 }
    );
  }
}