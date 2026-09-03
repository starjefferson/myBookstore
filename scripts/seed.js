/**
 * Standalone Firebase Firestore Seeder
 * Ingests scraped_catalog.json, zones.js, and mockData.js directly into Firestore
 * Performs Delta Sync and triggers automatic Next.js API cache revalidation
 * Run via CLI / GitHub Actions: node scripts/seed.js
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");

// Load environment variables from project root
loadEnvConfig(path.join(__dirname, ".."));

// Initialize Firebase Admin SDK safely
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

/**
 * Triggers Next.js On-Demand Revalidation Webhook
 */
async function triggerApiRevalidation() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  const secret = process.env.REVALIDATION_SECRET_TOKEN;

  if (!appUrl || !secret) {
    console.log("⚠ Skipping automated cache revalidation: NEXT_PUBLIC_APP_URL or REVALIDATION_SECRET_TOKEN is missing.");
    return;
  }

  const normalizedUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
  const revalidateEndpoint = `${normalizedUrl}/api/revalidate?secret=${secret}`;

  try {
    console.log(`\n--> Triggering automated API cache revalidation at ${normalizedUrl}...`);
    const res = await fetch(revalidateEndpoint, { method: "POST" });
    const data = await res.json();

    if (res.ok) {
      console.log("✅ Next.js API cache purged automatically. Live catalog is now updated!");
    } else {
      console.warn("⚠ Cache revalidation warning:", data.error || data.message);
    }
  } catch (err) {
    console.warn("⚠ Could not reach revalidation endpoint:", err.message);
  }
}

async function seed() {
  console.log("==========================================");
  console.log("🌱 Digital Concierge Bookstore Seeder");
  console.log("==========================================");

  try {
    const { SHIPPING_ZONES } = await import("../lib/zones.js");
    const { INITIAL_ORDERS } = await import("../lib/mockData.js");

    let scrapedBooks = [];
    const scrapedJsonPath = path.join(__dirname, "../scraped_catalog.json");
    if (fs.existsSync(scrapedJsonPath)) {
      scrapedBooks = JSON.parse(fs.readFileSync(scrapedJsonPath, "utf-8"));
      console.log(`✓ Loaded ${scrapedBooks.length} scraped catalog entries from scraped_catalog.json`);
    }

    // 1. Seed Shipping Zones
    if (SHIPPING_ZONES?.length) {
      const zoneBatch = db.batch();
      SHIPPING_ZONES.forEach((zone) => {
        const docId =
          zone.id ||
          zone.state?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
          zone.stateName?.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (docId) {
          const docRef = db.collection("shippingZones").doc(docId);
          zoneBatch.set(docRef, zone, { merge: true });
        }
      });
      await zoneBatch.commit();
      console.log(`✓ Wrote ${SHIPPING_ZONES.length} shipping zones to Firestore.`);
    }

    // 2. Write books to Firestore in batches (450 items per batch to save quota)
    if (scrapedBooks.length > 0) {
      console.log("--> Syncing books to Firestore...");
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

      // Update catalog metadata version document
      const currentVersion = new Date().toISOString();
      await db.collection("catalogMeta").doc("current").set(
        {
          version: currentVersion,
          updatedAt: currentVersion,
          bookCount: scrapedBooks.length,
          lastSyncMethod: "WooCommerce REST API Engine",
        },
        { merge: true }
      );
      console.log(`✓ Updated catalogMeta/current version metadata (${currentVersion}).`);
    }

    // 3. Seed Sample Orders
    if (INITIAL_ORDERS?.length) {
      const orderBatch = db.batch();
      INITIAL_ORDERS.forEach((order) => {
        if (order.id) {
          const docRef = db.collection("orders").doc(order.id);
          orderBatch.set(docRef, order, { merge: true });
        }
      });
      await orderBatch.commit();
      console.log(`✓ Wrote ${INITIAL_ORDERS.length} sample orders to Firestore.`);
    }

    console.log("\n✅ All seed data successfully written to Firestore.");

    // 4. Trigger Automatic Cache Invalidation
    await triggerApiRevalidation();
  } catch (err) {
    console.error("Seed execution error:", err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };