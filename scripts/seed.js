const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");

loadEnvConfig(path.join(__dirname, ".."));

if (!getApps().length && process.env.FIREBASE_PROJECT_ID) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ?.trim()
        .replace(/^['"]|['"]$/g, "")
        .replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function seed() {
  console.log("==========================================");
  console.log("🌱 Digital Concierge Bookstore Seeder");
  console.log("==========================================");

  try {
    const { SHIPPING_ZONES } = await import("../lib/zones.js");

    // 1. Seed Shipping Zones
    if (SHIPPING_ZONES?.length) {
      const zoneBatch = db.batch();
      SHIPPING_ZONES.forEach((zone) => {
        const docId = zone.id || zone.state?.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (docId) {
          const docRef = db.collection("shippingZones").doc(docId);
          zoneBatch.set(docRef, zone, { merge: true });
        }
      });
      await zoneBatch.commit();
      console.log(`✓ Wrote ${SHIPPING_ZONES.length} shipping zones to Firestore.`);
    }

    // 2. Load scraped_catalog.json
    const scrapedJsonPath = path.join(__dirname, "../scraped_catalog.json");
    if (!fs.existsSync(scrapedJsonPath)) {
      console.log("⚠ No scraped_catalog.json found. Skipping book seeding.");
      return;
    }

    const scrapedBooks = JSON.parse(fs.readFileSync(scrapedJsonPath, "utf-8"));
    console.log(`✓ Loaded ${scrapedBooks.length} entries from scraped_catalog.json`);

    // 3. Batch Upsert to Firestore (450 ops per batch, saves read quota)
    const BATCH_SIZE = 450;
    for (let i = 0; i < scrapedBooks.length; i += BATCH_SIZE) {
      const chunk = scrapedBooks.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      chunk.forEach((book) => {
        const docRef = db.collection("books").doc(book.id);
        batch.set(docRef, book, { merge: true });
      });

      await batch.commit();
      console.log(`  ✓ Synced batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} books)`);
    }

    console.log(`\n✅ Firestore seeding complete. Updated ${scrapedBooks.length} books.`);
  } catch (err) {
    console.error("Seed execution error:", err);
    process.exitCode = 1;
  }
}

seed();