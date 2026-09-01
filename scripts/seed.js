/**
 * Standalone Firebase Firestore Seeder
 * Ingests scraped_catalog.json, zones.js, and mockData.js directly into Firestore
 * Run: node scripts/seed.js
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");

loadEnvConfig(path.join(__dirname, ".."));

// Initialize Firebase Admin SDK
if (!getApps().length && process.env.FIREBASE_PROJECT_ID) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ?.trim()
        .replace(/^['"]|['"]$/g, "")
        .replace(/\\n/g, "\n"),
    })
  });
}

const db = getFirestore();

async function seed() {
  console.log("==========================================");
  console.log("🌱 Digital Concierge Bookstore Seeder");
  console.log("==========================================");

  try {
    const { SHIPPING_ZONES } = await import("../lib/zones.js");
    const { INITIAL_ORDERS } = await import("../lib/mockData.js");

    // Load scraped books JSON if available
    let scrapedBooks = [];
    const scrapedJsonPath = path.join(__dirname, "../scraped_catalog.json");
    if (fs.existsSync(scrapedJsonPath)) {
      scrapedBooks = JSON.parse(fs.readFileSync(scrapedJsonPath, "utf-8"));
      console.log(`✓ Loaded ${scrapedBooks.length} scraped catalog entries from scraped_catalog.json`);
    }

    const allBooks = scrapedBooks;

    // 1. Seed Shipping Zones
    if (SHIPPING_ZONES?.length) {
      const zoneBatch = db.batch();
      SHIPPING_ZONES.forEach((zone) => {
        const docId = zone.id || zone.state.toLowerCase().replace(/[^a-z0-9]/g, "");
        const docRef = db.collection("shippingZones").doc(docId);
        zoneBatch.set(docRef, zone, { merge: true });
      });
      await zoneBatch.commit();
      console.log(`✓ Wrote ${SHIPPING_ZONES.length} shipping zones to Firestore.`);
    }

    // 2. Delta sync: only write new or changed books to Firestore
    if (scrapedBooks.length > 0) {
      // Get existing book IDs and key fields for comparison
      const existingSnapshot = await db.collection("books").get();
      const existingBooks = new Map();
      existingSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        existingBooks.set(doc.id, {
          vendorPrice: data.vendorPrice,
          retailPrice: data.retailPrice,
          description: data.description,
          inStock: data.inStock,
          rating: data.rating,
          updatedAt: data.updatedAt
        });
      });

      // Identify new and changed books
      const newBooks = [];
      const changedBooks = [];

      scrapedBooks.forEach((book) => {
        if (!existingBooks.has(book.id)) {
          newBooks.push(book);
        } else {
          const existing = existingBooks.get(book.id);
          const hasChanges =
            existing.vendorPrice !== book.vendorPrice ||
            existing.retailPrice !== book.retailPrice ||
            existing.description !== book.description ||
            existing.inStock !== book.inStock ||
            existing.rating !== book.rating;
          if (hasChanges) {
            changedBooks.push(book);
          }
        }
      });

      // Write new and changed books in batches
      const booksToWrite = [...newBooks, ...changedBooks];
      if (booksToWrite.length > 0) {
        for (let start = 0; start < booksToWrite.length; start += 400) {
          const bookBatch = db.batch();
          booksToWrite.slice(start, start + 400).forEach((book) => {
            const docRef = db.collection("books").doc(book.id);
            bookBatch.set(docRef, book, { merge: true });
          });
          await bookBatch.commit();
        }
        console.log(
          `✓ Delta sync: ${newBooks.length} new books, ${changedBooks.length} changed books written to Firestore.`
        );
      } else {
        console.log(`✓ Delta sync: No new or changed books. Firestore catalog is current.`);
      }

      // Update catalogMeta version after all book writes complete
      await db.collection("catalogMeta").doc("current").set({
        version: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookCount: scrapedBooks.length
      });
    }

    // 3. Seed Sample Orders
    if (INITIAL_ORDERS?.length) {
      const orderBatch = db.batch();
      INITIAL_ORDERS.forEach((order) => {
        const docRef = db.collection("orders").doc(order.id);
        orderBatch.set(docRef, order, { merge: true });
      });
      await orderBatch.commit();
      console.log(`✓ Wrote ${INITIAL_ORDERS.length} sample orders to Firestore.`);
    }

    console.log("\n✅ All seed data successfully written to Firestore collections.");
  } catch (err) {
    console.error("Seed execution error:", err);
    process.exitCode = 1;
  }
}

seed();