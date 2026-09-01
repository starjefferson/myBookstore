/**
 * High-Speed Cloudinary Image Sync Script
 * Uses Cloudinary's native remote URL fetching + WebP conversion engine.
 * Automatically handles dead links with custom styled fallback covers.
 * 
 * Usage: node scripts/sync-images-to-cloudinary.js
 */

const fs = require("fs");
const path = require("path");
const { loadEnvConfig } = require("@next/env");
const cloudinary = require("cloudinary").v2;
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

loadEnvConfig(path.join(__dirname, ".."));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const getAdminDb = () => {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
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
            .replace(/\\n/g, "\n"),
        }),
      });

  return getFirestore(app);
};

const CATALOG_PATH = path.join(__dirname, "..", "scraped_catalog.json");
const CONCURRENCY = 10; // 10 parallel uploads for rapid completion

function generateSvgCover(book) {
  const title = book.title || "Untitled Book";
  const author = book.author || "Unknown Author";
  const category = book.category || "General";
  
  const escapeXml = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const lines = [];
  const words = title.trim().split(/\s+/);
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= 18) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= 3) break;
    }
  }
  if (cur && lines.length < 4) lines.push(cur);

  const titleSvg = lines
    .map((l, i) => `<text x="200" y="${180 + i * 28}" font-family="sans-serif" font-weight="800" font-size="20" fill="#ffffff" text-anchor="middle">${escapeXml(l)}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">
    <rect width="400" height="560" fill="#090a0f"/>
    <rect x="15" y="15" width="370" height="530" fill="none" stroke="#38bdf8" stroke-width="1.5" rx="6"/>
    <rect x="130" y="65" width="140" height="26" rx="13" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
    <text x="200" y="82" font-family="sans-serif" font-weight="700" font-size="10" fill="#38bdf8" text-anchor="middle" letter-spacing="0.1em">${escapeXml(category).toUpperCase()}</text>
    ${titleSvg}
    <text x="200" y="420" font-family="sans-serif" font-weight="600" font-size="13" fill="#94a3b8" text-anchor="middle">BY ${escapeXml(author).toUpperCase()}</text>
    <text x="200" y="520" font-family="sans-serif" font-weight="600" font-size="9" fill="#475569" text-anchor="middle" letter-spacing="0.15em">CONCIERGE BOOKSTORE</text>
  </svg>`;
}

async function uploadSingleBook(book) {
  if (book.coverImage && book.coverImage.includes("res.cloudinary.com")) {
    return { book, uploaded: false, status: "already_synced" };
  }

  const safePublicId = (book.id || `bk_${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .substring(0, 80);

  const rawUrl = (book.coverImage || "").trim();

  // Try direct remote URL upload first
  if (rawUrl && rawUrl.startsWith("http")) {
    try {
      const res = await cloudinary.uploader.upload(rawUrl, {
        folder: "bookstore_covers",
        public_id: safePublicId,
        format: "webp",
        overwrite: false,
        timeout: 10000,
        transformation: [{ width: 500, height: 700, crop: "limit", quality: "auto:eco" }],
      });

      if (res && res.secure_url) {
        book.coverImage = res.secure_url;
        return { book, uploaded: true, status: "success" };
      }
    } catch {
      // Fallback to custom SVG if vendor link was dead / 404 / 403
    }
  }

  // Fallback: upload bespoke SVG cover
  try {
    const svg = generateSvgCover(book);
    const base64 = Buffer.from(svg).toString("base64");
    const dataUri = `data:image/svg+xml;base64,${base64}`;

    const res = await cloudinary.uploader.upload(dataUri, {
      folder: "bookstore_covers",
      public_id: safePublicId,
      format: "webp",
      overwrite: false,
    });

    if (res && res.secure_url) {
      book.coverImage = res.secure_url;
      return { book, uploaded: true, status: "svg_fallback" };
    }
  } catch (err) {
    return { book, uploaded: false, error: err.message, status: "error" };
  }

  return { book, uploaded: false, status: "failed" };
}

async function main() {
  console.log("==================================================");
  console.log("   CONCIERGE BOOKSTORE — CLOUDINARY IMAGE SYNC    ");
  console.log("==================================================");

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error("❌ scraped_catalog.json not found!");
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const books = Array.isArray(catalog) ? catalog : catalog.books || [];
  console.log(`📚 Total catalog books: ${books.length}`);

  const alreadySynced = books.filter(
    (b) => b.coverImage && b.coverImage.includes("res.cloudinary.com")
  ).length;
  console.log(`✅ Already on Cloudinary: ${alreadySynced}`);
  console.log(`⏳ Pending uploads: ${books.length - alreadySynced}\n`);

  let processed = 0;
  let newUploads = 0;
  let errors = 0;

  for (let i = 0; i < books.length; i += CONCURRENCY) {
    const chunk = books.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((b) => uploadSingleBook(b)));

    for (const r of results) {
      processed++;
      if (r.uploaded) newUploads++;
      if (r.status === "error") errors++;
    }

    if (processed % 20 === 0 || processed === books.length) {
      const pct = ((processed / books.length) * 100).toFixed(1);
      console.log(`[${pct}%] ${processed}/${books.length} processed — Uploaded: ${newUploads}, Errors: ${errors}`);
    }

    if (processed % 100 === 0 || processed === books.length) {
      fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");
    }
  }

  // Final JSON save
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");
  console.log(`\n🎉 All ${books.length} books processed! (${newUploads} new Cloudinary uploads)`);

  // Sync to Firestore
  const db = getAdminDb();
  if (db && newUploads > 0) {
    console.log("\n🔥 Syncing updated Cloudinary image URLs to Firestore in batches...");
    const batchSize = 400;
    for (let i = 0; i < books.length; i += batchSize) {
      const batch = db.batch();
      const slice = books.slice(i, i + batchSize);
      for (const b of slice) {
        if (b.id && b.coverImage) {
          batch.set(db.collection("books").doc(b.id), { coverImage: b.coverImage }, { merge: true });
        }
      }
      await batch.commit();
      console.log(`   • Firestore batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(books.length / batchSize)} synced`);
    }

    const version = new Date().toISOString();
    await db.collection("catalogMeta").doc("current").set({
      version,
      updatedAt: version,
      bookCount: books.length,
      imageSource: "cloudinary",
    }, { merge: true });
    console.log("✅ Firestore catalogMeta version updated.");
  }

  console.log("\n✅ Done! All book covers are now permanently hosted on Cloudinary CDN.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
