/**
 * Standalone Firebase Firestore Seeder
 * Ingests scraped_catalog.json, zones.js, and mockData.js directly into Firestore
 * Performs Delta Sync (only writes new or modified books to preserve Firestore write quota)
 * Run via CLI / GitHub Actions: node scripts/seed.js
 */

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

    // 2. Delta Sync: Only write new or changed books to Firestore
    if (scrapedBooks.length > 0) {
      console.log("--> Fetching existing catalog snapshot for diff calculation...");
      const existingSnapshot = await db.collection("books").get();
      const existingBooks = new Map();

      existingSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        existingBooks.set(doc.id, {
          title: data.title,
          author: data.author,
          vendorPrice: data.vendorPrice,
          retailPrice: data.retailPrice,
          description: data.description,
          coverImage: data.coverImage,
          inStock: data.inStock,
          stockQuantity: data.stockQuantity,
          category: data.category,
        });
      });

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
            existing.coverImage !== book.coverImage ||
            existing.inStock !== book.inStock ||
            existing.stockQuantity !== book.stockQuantity ||
            existing.title !== book.title ||
            existing.author !== book.author ||
            existing.category !== book.category;

          if (hasChanges) {
            changedBooks.push(book);
          }
        }
      });

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
          `✓ Delta sync complete: ${newBooks.length} new books, ${changedBooks.length} updated books written to Firestore.`
        );
      } else {
        console.log(`✓ Delta sync complete: No changes detected. Firestore catalog is up to date.`);
      }

      // Update catalog metadata version
      await db.collection("catalogMeta").doc("current").set(
        {
          version: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          bookCount: scrapedBooks.length,
        },
        { merge: true }
      );
      console.log(`✓ Updated catalogMeta/current version metadata.`);
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

    console.log("\n✅ All seed data successfully synchronized with Firestore.");
  } catch (err) {
    console.error("Seed execution error:", err);
    process.exitCode = 1;
  }
}

seed();