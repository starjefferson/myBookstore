/**
 * Standalone REST API Catalog Ingestion Engine
 * Syncs catalog data from Masobe Books, Rovingheights, and Retala into Firestore & JSON
 * Batch Size: 24 items per page via WooCommerce REST APIs
 * Uses Playwright as an API client for Rovingheights to bypass Cloudflare WAF without DOM scraping
 * Run via cron / CLI: node scripts/scrape.js
 * Cron schedule: Twice per week (Mon/Thu 2:00 AM UTC)
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnvConfig } = require("@next/env");
const { BOOK_CATEGORIES, classifyBookCategory } = require("../lib/categoryTaxonomy");

// Load environment variables from project root
loadEnvConfig(path.join(__dirname, ".."));

// Initialize Firebase Admin SDK safely using subpath imports
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

// Configurable constants
const RETAIL_MARKUP_PERCENT = 0.10; // 10% Retail Markup
const ITEMS_PER_PAGE = 24; // 24 items per page request
const MAX_PAGES_PER_VENDOR = Number(process.env.MAX_PAGES) || 50;

/**
 * Calculates retail price with 10% markup rounded up to nearest ₦100
 */
const calculateRetailPrice = (vendorPrice) => {
  if (!vendorPrice || isNaN(vendorPrice) || vendorPrice <= 0) return null;
  const markedUp = vendorPrice * (1 + RETAIL_MARKUP_PERCENT);
  return Math.ceil(markedUp / 100) * 100;
};

/**
 * Cleans price input strings
 */
const cleanPriceString = (text) => {
  if (!text) return null;
  const normalized = String(text).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const currencyMatches = normalized.match(/(?:₦|NGN)\s*[\d,]+(?:\.\d{1,2})?/gi) || [];
  const numberMatches = normalized.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+(?:\.\d{1,2})?\b/g) || [];
  const candidates = currencyMatches.length ? currencyMatches : numberMatches;

  for (const candidate of candidates) {
    const parsed = Number.parseFloat(candidate.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

/**
 * Strips HTML tags from raw descriptions
 */
const cleanDescription = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>?/gm, "")
    .replace(/sourced\s+(?:through|from|via)\s+(?:Rovingheights|Retala|Masoba|Masobe)/gi, "sourced")
    .replace(/published\s+by\s+(?:Rovingheights|Retala|Masoba|Masobe)/gi, "published")
    .replace(/available\s+at\s+(?:Rovingheights|Retala|Masoba|Masobe)/gi, "available")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 500);
};

/**
 * Cleans author names and strips genre/tag prefixes
 */
const cleanAuthor = (value) => {
  if (!value) return "Featured Author";

  const ignoredKeywords = [
    "tags", "mystery", "thriller", "ya", "short stories", "niger delta",
    "political", "fantasy", "fantasy fiction", "speculative fiction",
    "poetry", "literary fiction", "romance", "children's books",
    "children's fiction", "middle grade", "biafra", "civil war",
    "memoir", "non-fiction", "african literature", "business", "fiction", "books"
  ];

  let author = String(value)
    .replace(/^(by|author)\s*:\s*/i, "")
    .replace(/^tags?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  author = author.split(/\s*\d+(?:\.\d+)?\s*\/\s*5(?:\.0)?/i)[0].trim();

  const tokens = author.split(",").map((t) => t.trim()).filter(Boolean);
  const candidateTokens = tokens.filter(
    (token) => !ignoredKeywords.includes(token.toLowerCase())
  );

  if (candidateTokens.length === 0) return "Featured Author";
  return candidateTokens[0];
};

/**
 * Validates product URL format
 */
const isValidProductUrl = (value) => {
  if (!value || /^(#|javascript:|about:|mailto:)/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return /^https?:$/i.test(parsed.protocol) && Boolean(parsed.hostname);
  } catch (error) {
    return false;
  }
};

/**
 * Validates book title length and quality
 */
const isValidBookTitle = (value) => {
  if (!value) return false;
  const title = String(value).replace(/\s+/g, " ").trim();
  return title.length >= 2 && !/^(books?|upcoming books?)$/i.test(title);
};

/**
 * Generates fallback description if empty
 */
const generateDescription = (item) => {
  const cleaned = cleanDescription(item.description || item.short_description);
  if (cleaned && cleaned.length > 20) return cleaned;
  return `Authentic physical edition of "${item.name}" by ${cleanAuthor(item.images?.[0]?.alt)}.`;
};

/**
 * Fetches Rovingheights REST API via Playwright browser context.
 * Bypasses Cloudflare WAF without scraping HTML DOM elements.
 */
async function fetchRovingheightsViaBrowserApi(browser, maxPages = MAX_PAGES_PER_VENDOR) {
  console.log(`--> [Browser API Client] Fetching REST API catalog from rovingheights (https://rhbooks.com.ng) at ${ITEMS_PER_PAGE} items/page...`);
  const books = [];

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // 1. Visit homepage to obtain Cloudflare clearance session
    await page.goto("https://rhbooks.com.ng", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);

    let pageNum = 1;
    while (pageNum <= maxPages) {
      const targetApiUrl = `https://rhbooks.com.ng/wp-json/wc/store/v1/products?per_page=${ITEMS_PER_PAGE}&page=${pageNum}`;

      // 2. Fetch WooCommerce REST API JSON inside cleared browser context
      const products = await page.evaluate(async (apiUrl) => {
        try {
          const res = await fetch(apiUrl, {
            headers: { "Accept": "application/json" },
          });
          if (!res.ok) return null;
          return await res.json();
        } catch (err) {
          return null;
        }
      }, targetApiUrl);

      if (!Array.isArray(products) || products.length === 0) {
        console.log(`  ✓ rovingheights: Catalog pagination complete at page ${pageNum - 1}.`);
        break;
      }

      for (const item of products) {
        const rawPrice = parseInt(item.prices?.price || "0", 10) / 100;
        const vendorPrice = rawPrice > 0 ? rawPrice : null;
        const retailPrice = calculateRetailPrice(vendorPrice);

        const desc = generateDescription(item);
        const coverImage = item.images?.[0]?.src || "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800";
        const authorText = item.images?.[0]?.alt || item.categories?.[0]?.name || "";
        const author = cleanAuthor(authorText);
        const slug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        const rawCategory = item.categories?.[0]?.name || "General";
        const classifiedCategory = classifyBookCategory 
          ? classifyBookCategory({ title: item.name, description: desc, category: rawCategory }) 
          : rawCategory;

        books.push({
          id: `rovingheights-${pageNum}-${slug}`,
          title: item.name,
          author: author,
          description: desc,
          coverImage: coverImage,
          vendorPrice: vendorPrice,
          retailPrice: retailPrice,
          sourceVendor: "rovingheights",
          sourceUrl: item.permalink || `https://rhbooks.com.ng/product/${slug}/`,
          category: classifiedCategory,
          inStock: item.is_in_stock ?? true,
          stockQuantity: item.low_stock_remaining !== undefined ? item.low_stock_remaining : null,
          rating: 4.8,
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(`  ✓ rovingheights Page ${pageNum}: Fetched ${products.length} items.`);
      pageNum++;
      await page.waitForTimeout(1000);
    }
  } catch (err) {
    console.warn(`  ⚠ Error fetching rovingheights via browser API:`, err.message);
  } finally {
    await context.close();
  }

  return books;
}

/**
 * Fetches vendor catalog via native WooCommerce REST API (used for Retala & Masobe)
 */
async function fetchStandardWooCommerceVendor(baseUrl, vendorSlug, maxPages = MAX_PAGES_PER_VENDOR) {
  console.log(`--> Fetching REST API catalog from ${vendorSlug} (${baseUrl}) at ${ITEMS_PER_PAGE} items/page...`);
  const books = [];
  let page = 1;

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": `${baseUrl}/`,
    "Origin": baseUrl,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  while (page <= maxPages) {
    try {
      const targetApiUrl = `${baseUrl}/wp-json/wc/store/v1/products?per_page=${ITEMS_PER_PAGE}&page=${page}`;
      const response = await fetch(targetApiUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      if (!response.ok) {
        console.warn(`  ⚠ ${vendorSlug} API page ${page} returned status ${response.status}. Ending pagination.`);
        break;
      }

      const products = await response.json();
      if (!Array.isArray(products) || products.length === 0) {
        console.log(`  ✓ ${vendorSlug}: Catalog pagination complete at page ${page - 1}.`);
        break;
      }

      for (const item of products) {
        const rawPrice = parseInt(item.prices?.price || "0", 10) / 100;
        const vendorPrice = rawPrice > 0 ? rawPrice : null;
        const retailPrice = calculateRetailPrice(vendorPrice);

        const desc = generateDescription(item);
        const coverImage = item.images?.[0]?.src || "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800";
        const authorText = item.images?.[0]?.alt || item.categories?.[0]?.name || "";
        const author = cleanAuthor(authorText);
        const slug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        const rawCategory = item.categories?.[0]?.name || "General";
        const classifiedCategory = classifyBookCategory 
          ? classifyBookCategory({ title: item.name, description: desc, category: rawCategory }) 
          : rawCategory;

        books.push({
          id: `${vendorSlug}-${page}-${slug}`,
          title: item.name,
          author: author,
          description: desc,
          coverImage: coverImage,
          vendorPrice: vendorPrice,
          retailPrice: retailPrice,
          sourceVendor: vendorSlug,
          sourceUrl: item.permalink || `${baseUrl}/product/${slug}/`,
          category: classifiedCategory,
          inStock: item.is_in_stock ?? true,
          stockQuantity: item.low_stock_remaining !== undefined ? item.low_stock_remaining : null,
          rating: 4.8,
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(`  ✓ ${vendorSlug} Page ${page}: Fetched ${products.length} items.`);
      page++;
    } catch (err) {
      console.warn(`  ⚠ Error fetching ${vendorSlug} page ${page}:`, err.message);
      break;
    }
  }

  return books;
}

/**
 * Saves local catalog snapshot and category counts filter file
 */
function persistCatalog(books) {
  const validBooks = books.filter((book) =>
    isValidBookTitle(book.title) && isValidProductUrl(book.sourceUrl)
  );

  const outputPath = path.join(__dirname, "../scraped_catalog.json");
  fs.writeFileSync(outputPath, JSON.stringify(validBooks, null, 2), "utf-8");

  const categoriesSet = new Set(validBooks.map((book) => book.category).filter(Boolean));
  const uniqueCategories = BOOK_CATEGORIES ? BOOK_CATEGORIES.filter((category) => categoriesSet.has(category)) : Array.from(categoriesSet);
  const filterPath = path.join(__dirname, "../lib/categoryFilters.json");
  
  fs.writeFileSync(
    filterPath,
    JSON.stringify(
      {
        version: 1,
        lastUpdated: new Date().toISOString(),
        categories: uniqueCategories.map((category) => ({
          id: category.toLowerCase().replace(/\s+/g, "-"),
          name: category,
          count: validBooks.filter((book) => book.category === category).length,
        })),
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\n✓ Saved checkpoint: ${validBooks.length} valid books written to scraped_catalog.json & categoryFilters.json`);
}

async function main() {
  console.log("=========================================");
  console.log("🚀 Starting WooCommerce REST API Catalog Ingestion...");
  console.log(`📦 Batch Size: ${ITEMS_PER_PAGE} items per page`);
  console.log("=========================================");

  let browser;
  let rovingBooks = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // 1. Fetch Rovingheights via Playwright Browser API Context
    rovingBooks = await fetchRovingheightsViaBrowserApi(browser);
  } catch (err) {
    console.warn("⚠ Browser initialization error for Rovingheights:", err.message);
  } finally {
    if (browser) await browser.close();
  }

  // 2. Fetch Retala and Masobe via native HTTP REST API
  const retalaBooks = await fetchStandardWooCommerceVendor("https://retala.com.ng", "retala");
  const masobeBooks = await fetchStandardWooCommerceVendor("https://masobebooks.com/ng", "masobe");

  const combined = [...rovingBooks, ...retalaBooks, ...masobeBooks];

  // 3. Save local snapshot
  persistCatalog(combined);

  // 4. Direct Sync to Firestore if Admin SDK credentials are active
  if (getApps().length && combined.length > 0) {
    console.log("Uploading catalog records directly to Firestore...");
    const db = getFirestore();
    const batch = db.batch();
    
    combined.forEach((book) => {
      if (isValidBookTitle(book.title) && isValidProductUrl(book.sourceUrl)) {
        const docRef = db.collection("books").doc(book.id);
        batch.set(docRef, book, { merge: true });
      }
    });

    await batch.commit();
    console.log(`✓ Successfully updated ${combined.length} books in Firestore.`);
  }

  console.log("\n✅ Catalog ingestion complete.");
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchRovingheightsViaBrowserApi,
  fetchStandardWooCommerceVendor,
  calculateRetailPrice,
  cleanPriceString,
  cleanAuthor,
  cleanDescription,
  isValidBookTitle,
  isValidProductUrl,
  persistCatalog,
};