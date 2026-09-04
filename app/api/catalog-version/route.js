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

export const dynamic = "force-dynamic";

/**
 * Next.js Tagged Cache for Catalog Version Metadata
 * Instantly invalidated when revalidateTag("catalogMeta") or revalidateTag("catalog") runs
 */
const getCachedVersion = unstable_cache(
  async () => {
    const db = getAdminDb();
    if (!db) return null;

    const snapshot = await db.collection("catalogMeta").doc("current").get();
    return snapshot.exists ? snapshot.data() : { version: null };
  },
  ["catalog-version-meta"],
  {
    revalidate: 302400, // 3.5 days fallback
    tags: ["catalogMeta", "catalog"],
  }
);

export async function GET() {
  try {
    const versionData = await getCachedVersion();

    if (!versionData) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    return NextResponse.json(versionData, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Catalog version API error:", error);
    return NextResponse.json({ error: "Unable to check catalog version" }, { status: 500 });
  }
}