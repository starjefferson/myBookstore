import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

    // Direct Firestore fetch — bypasses unstable_cache payload size limits
    const snapshot = await db.collection("books").get();

    const rawBooks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Convert Firestore Timestamps and complex objects into standard JSON primitives
    const books = JSON.parse(JSON.stringify(rawBooks));

    return NextResponse.json(books, {
      headers: {
        // Cache on Vercel Edge CDN for 3.5 days (302,400s) to align with Mondays & Thursdays 02:00 UTC syncs
        // revalidatePath("/api/catalog") in /api/revalidate purges this Edge CDN cache on demand
        "Cache-Control": "public, s-maxage=302400, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Catalog API Error Trace:", error?.stack || error);
    return NextResponse.json(
      { error: "Unable to load catalog from Firestore", details: error?.message },
      { status: 500 }
    );
  }
}