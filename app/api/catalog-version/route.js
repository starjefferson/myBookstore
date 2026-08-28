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

let versionCache = null;
let versionCacheExpiresAt = 0;

export async function GET() {
  try {
    if (versionCache && Date.now() < versionCacheExpiresAt) {
      return NextResponse.json(versionCache, { headers: { "Cache-Control": "no-store" } });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const snapshot = await db.collection("catalogMeta").doc("current").get();
    versionCache = snapshot.exists ? snapshot.data() : { version: null };
    versionCacheExpiresAt = Date.now() + 5 * 60 * 1000;
    return NextResponse.json(versionCache, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("Catalog version API error:", error);
    return NextResponse.json({ error: "Unable to check catalog version" }, { status: 500 });
  }
}