/**
 * Standalone Playwright Scraper for Vendor Catalogs
 * Syncs catalog data from Masobe Books, Rovingheights, and Retala into Firestore & JSON
 * Scrapes by category with pagination: up to 50 pages per category
 * Run via cron / CLI: node scripts/scrape.js
 * Cron schedule: 2x per week (e.g., Mon/Thu 2 AM)
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { loadEnvConfig } = require("@next/env");
const { BOOK_CATEGORIES, classifyBookCategory } = require("../lib/categoryTaxonomy");

loadEnvConfig(path.join(__dirname, ".."));

const RETAIL_MARKUP_PERCENT = 0.10;
const MAX_PAGES_PER_CATEGORY = 50; // Scrape up to 50 pages per category
const AUTHOR_LOOKUP_CONCURRENCY = Number(process.env.AUTHOR_LOOKUP_CONCURRENCY) || 2;
const SCRAPE_AUTHORS = process.env.SCRAPE_AUTHORS !== "false";
const SCRAPE_MASOBE = process.env.SCRAPE_MASOBE === "true";
const SCRAPE_FRESH = process.env.SCRAPE_FRESH === "true";
const NAVIGATION_RETRIES = Number(process.env.SCRAPE_NAVIGATION_RETRIES) || 3;
const NAVIGATION_TIMEOUT = Number(process.env.SCRAPE_NAVIGATION_TIMEOUT) || 30000;
const SELECTOR_TIMEOUT = Number(process.env.SCRAPE_SELECTOR_TIMEOUT) || 15000;

const calculateRetailPrice = (vendorPrice) => {
  // If price is missing, unparsed, or <= 0, return null so it displays as unavailable
  if (!vendorPrice || isNaN(vendorPrice) || vendorPrice <= 0) return null;

  const markedUp = vendorPrice * (1 + RETAIL_MARKUP_PERCENT);
  return Math.ceil(markedUp / 100) * 100;
};

const cleanPriceString = (text) => {
  if (!text) return null;
  const normalized = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const currencyMatches = normalized.match(/(?:₦|NGN)\s*[\d,]+(?:\.\d{1,2})?/gi) || [];
  const numberMatches = normalized.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+(?:\.\d{1,2})?\b/g) || [];
  const candidates = currencyMatches.length ? currencyMatches : numberMatches;

  for (const candidate of candidates) {
    const parsed = Number.parseFloat(candidate.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const parseStockStatus = (text) => {
  if (!text) return true;
  return !/(out\s*of\s*stock|sold\s*out|unavailable|not\s+available|coming\s+soon)/i.test(text);
};

const isValidProductUrl = (value) => {
  if (!value || /^(#|javascript:|about:|mailto:)/i.test(value)) return false;

  try {
    const parsed = new URL(value);
    if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) return false;
    if (!parsed.pathname || parsed.pathname === "/") return false;
    return /\/product\//i.test(parsed.pathname) && !/\/product-category\//i.test(parsed.pathname);
  } catch (error) {
    return false;
  }
};

const isValidBookTitle = (value) => {
  if (!value) return false;
  const title = value.replace(/\s+/g, " ").trim();
  return title.length >= 2 && !/^(books?|upcoming books?)$/i.test(title);
};

async function visitCatalogPage(page, url, selectors, options = {}) {
  const retries = options.retries || NAVIGATION_RETRIES;
  const timeout = options.timeout || NAVIGATION_TIMEOUT;
  const selectorTimeout = options.selectorTimeout || SELECTOR_TIMEOUT;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForSelector(selectors, { state: "attached", timeout: selectorTimeout });
      return true;
    } catch (error) {
      lastError = error;
      console.warn(`   Page visit ${attempt}/${retries} failed for ${url}: ${error.message}`);
      if (attempt < retries) {
        await page.waitForTimeout(Math.min(1000 * attempt, 3000));
      }
    }
  }

  console.warn(`   Skipping page after ${retries} attempts: ${lastError?.message || url}`);
  return false;
}

const cleanAuthor = (value) => {
  if (!value) return "";
  let author = value
    .replace(/^(by|author)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  author = author.replace(/^tags?\s*:\s*/i, "");
  author = author.split(/\s*\d+(?:\.\d+)?\s*\/\s*5(?:\.0)?/i)[0].trim();

  if (value.match(/^tags?\s*:/i)) {
    return `Tags: ${author}`;
  }

  if (!author || /^(fiction|african literature|business|memoir|books?)$/i.test(author)) {
    return "";
  }

  return author;
};

async function addAuthorDetails(page, items, options = {}) {
  if (!SCRAPE_AUTHORS) return items;
  const lookupTimeout = options.timeout || 15000;
  const loadTimeout = options.loadTimeout || 10000;

  const pendingItems = items.filter((item) =>
    !cleanAuthor(item.authorText) && isValidProductUrl(item.sourceUrl)
  );
  let nextItemIndex = 0;

  const lookupAuthor = async () => {
    const detailPage = await page.context().newPage();

    try {
      while (nextItemIndex < pendingItems.length) {
        const item = pendingItems[nextItemIndex++];

        try {
          await detailPage.goto(item.sourceUrl, {
            waitUntil: "commit",
            timeout: lookupTimeout
          });
          await detailPage.waitForLoadState("domcontentloaded", { timeout: loadTimeout }).catch(() => {});

          item.authorText = await detailPage.evaluate(() => {
            const selectors = [
              "[itemprop='author']", ".product-author", ".book-author", ".author-name",
              "[rel='author']", ".byline", ".woocommerce-product-details__short-description .author"
            ];

            for (const selector of selectors) {
              const element = document.querySelector(selector);
              const value = element?.textContent?.trim();
              if (value) return value;
            }

            for (const row of document.querySelectorAll("tr")) {
              const cells = Array.from(row.querySelectorAll("th, td"));
              const label = cells[0]?.textContent?.trim().replace(/\s+/g, " ");
              const value = cells[1]?.textContent?.trim().replace(/\s+/g, " ");
              if (/^author\s*:?$/i.test(label || "") && value) return value;
            }

            for (const script of document.querySelectorAll("script[type='application/ld+json']")) {
              try {
                const data = JSON.parse(script.textContent);
                const records = Array.isArray(data) ? data : [data, ...(data?.['@graph'] || [])];
                for (const record of records) {
                  const author = record?.author;
                  const name = Array.isArray(author)
                    ? author.map((entry) => entry?.name || entry).filter(Boolean).join(", ")
                    : author?.name || author;
                  if (name && typeof name === "string") return name.trim();
                }
              } catch (error) {
                // Ignore malformed structured data and continue with other sources.
              }
            }

            const metaAuthor = document.querySelector("meta[name='author'], meta[property='article:author']")?.content;
            if (metaAuthor?.trim()) return metaAuthor.trim();

            const tagElements = document.querySelectorAll(".tagged_as a, .tags a, a[rel='tag']");
            const tags = Array.from(tagElements)
              .map((element) => element.textContent.trim())
              .filter(Boolean);
            return tags.length ? `Tags: ${tags.join(", ")}` : "";
          });
        } catch (error) {
          console.warn(`   Author lookup failed for ${item.title}: ${error.message}`);
          if (/Target page, context or browser has been closed/i.test(error.message)) {
            return;
          }
        }
      }
    } finally {
      await detailPage.close();
    }
  };

  const workerCount = Math.min(
    options.concurrency || AUTHOR_LOOKUP_CONCURRENCY,
    pendingItems.length
  );
  await Promise.all(Array.from({ length: workerCount }, () => lookupAuthor()));

  return items;
}

/**
 * 1. Scrape Masoba Books with Category Pagination
 * URL: https://masobebooks.com/ng/bookstore/page/1/
 */
async function scrapeMasoba(page) {
  console.log("--> Scraping Masoba Books catalog (6 pages)...");
  const books = [];
  
  try {
    // Scrape all 6 pages
    for (let pageNum = 1; pageNum <= 6; pageNum++) {
      const url = `https://masobebooks.com/ng/bookstore/page/${pageNum}/`;
      console.log(`   • Page ${pageNum}/6: ${url}`);
      
      const pageLoaded = await visitCatalogPage(
        page,
        url,
        ".product, .type-product, .book-item, article"
      );
      if (!pageLoaded) {
        continue;
      }

      const items = await page.$$eval(".product, .type-product, .book-item, article", (elements) => {
        return elements.map((el) => {
          const titleEl = el.querySelector(".woocommerce-loop-product__title, .product-title, h2, h3");
          const priceEl = el.querySelector(".price, .amount, .woocommerce-Price-amount");
          const authorEl = el.querySelector("[itemprop='author'], .product-author, .book-author, .author-name");
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector(".woocommerce-loop-product__title a, h2 a, h3 a, a[href*='/product/'], a[href]");
          const categoryEl = el.querySelector(".product-category, .cat-links, .category");

          return {
            title: titleEl ? titleEl.innerText.trim() : "",
            authorText: authorEl ? authorEl.innerText.trim() : "",
            priceText: priceEl ? priceEl.innerText.trim() : "",
            stockText: el.innerText.trim(),
            coverImage: imgEl ? (imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy-src") || imgEl.getAttribute("data-original") || imgEl.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0] || imgEl.getAttribute("src") || "") : "",
            sourceUrl: linkEl ? linkEl.href : "",
            category: categoryEl ? categoryEl.innerText.trim() : "African Literature"
          };
        });
      });

      await addAuthorDetails(page, items);

      const pageBooks = [];
      for (const item of items) {
        if (!isValidBookTitle(item.title) || !isValidProductUrl(item.sourceUrl)) continue;
        
        const vendorPrice = cleanPriceString(item.priceText);
        if (!vendorPrice) continue;
        const retailPrice = calculateRetailPrice(vendorPrice);
        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50);

        pageBooks.push({
          id: `masobe-${pageNum}-${slug}`,
          title: item.title,
          author: cleanAuthor(item.authorText) || "Unknown Author",
          description: `Authentic physical edition of "${item.title}" published by Masoba Books.`,
          coverImage: item.coverImage || "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800",
          vendorPrice: vendorPrice,
          retailPrice: retailPrice,
          sourceVendor: "masoba",
          sourceUrl: item.sourceUrl,
          category: classifyBookCategory(item),
          inStock: parseStockStatus(item.stockText),
          rating: 4.8,
          updatedAt: new Date().toISOString()
        });
      }
      books.push(...pageBooks);
    }
  } catch (err) {
    console.warn("Masoba scraper warning:", err.message);
  }
  
  return books;
}


/**
 * 2. Scrape Rovingheights with Pagination
 * URL: https://rhbooks.com.ng/shop-2/ and /page/N/ for later pages
 */
async function scrapeRovingheights(page, options = {}) {
  console.log("--> Scraping Rovingheights catalog...");
  const books = [];
  const startPage = options.startPage || 1;
  
  try {
    // Scrape up to MAX_PAGES_PER_CATEGORY pages
    for (let pageNum = startPage; pageNum <= MAX_PAGES_PER_CATEGORY; pageNum++) {
      const url = pageNum === 1
        ? "https://rhbooks.com.ng/shop-2/"
        : `https://rhbooks.com.ng/shop-2/page/${pageNum}/`;
      console.log(`   • Page ${pageNum}/${MAX_PAGES_PER_CATEGORY}: ${url}`);
      
      const pageLoaded = await visitCatalogPage(
        page,
        url,
        ".product, .product-grid-item, .wd-entities"
      );
      if (!pageLoaded) {
        console.log(`   ⚠ Skipping page ${pageNum}; continuing pagination`);
        continue;
      }

      const items = await page.$$eval(".product, .product-grid-item, .wd-entities", (elements) => {
        return elements.map((el) => {
          const titleEl = el.querySelector(".wd-entities-title, .woocommerce-loop-product__title, h3, h2");
          const priceEl = el.querySelector(".price, .amount");
          const authorEl = el.querySelector(
            "[itemprop='author'], .product-author, .book-author, .author-name, .tagged_as, .tags"
          );
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector(".wd-entities-title a, .woocommerce-loop-product__title a, h2 a, h3 a, a[href*='/product/'], a[href]");
          const categoryEl = el.querySelector(".product-category, .cat-links");

          return {
            title: titleEl ? titleEl.innerText.trim() : "",
            authorText: authorEl ? authorEl.innerText.trim() : "",
            priceText: priceEl ? priceEl.innerText.trim() : "",
            stockText: el.innerText.trim(),
            coverImage: imgEl ? (imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy-src") || imgEl.getAttribute("data-original") || imgEl.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0] || imgEl.getAttribute("src") || "") : "",
            sourceUrl: linkEl ? linkEl.href : "",
            category: categoryEl ? categoryEl.innerText.trim() : ""
          };
        });
      });

      await addAuthorDetails(page, items, {
        concurrency: AUTHOR_LOOKUP_CONCURRENCY,
        timeout: 15000,
        loadTimeout: 10000
      });

      if (page.isClosed()) {
        throw new Error("Rovingheights browser page closed during author lookups; stopping to preserve the checkpoint.");
      }

      if (items.length === 0) {
        console.log(`   ⚠ No items found on page ${pageNum}, stopping pagination`);
        break;
      }

      const pageBooks = [];
      for (const item of items) {
        if (!isValidBookTitle(item.title) || !isValidProductUrl(item.sourceUrl)) continue;
        
        const vendorPrice = cleanPriceString(item.priceText);
        if (!vendorPrice) continue;
        const retailPrice = calculateRetailPrice(vendorPrice);
        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50);

        pageBooks.push({
          id: `roving-${pageNum}-${slug}`,
          title: item.title,
          author: cleanAuthor(item.authorText) || "Unknown Author",
          description: `Genuine physical copy of "${item.title}" sourced through Rovingheights.`,
          coverImage: item.coverImage || "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800",
          vendorPrice: vendorPrice,
          retailPrice: retailPrice,
          sourceVendor: "rovingheights",
          sourceUrl: item.sourceUrl,
          category: classifyBookCategory(item),
          inStock: parseStockStatus(item.stockText),
          rating: 4.9,
          updatedAt: new Date().toISOString()
        });
      }
      books.push(...pageBooks);

      if (options.onPageComplete) {
        await options.onPageComplete(pageNum, pageBooks);
      }
    }
  } catch (err) {
    console.warn("Rovingheights scraper warning:", err.message);
  }
  
  return books;
}


/**
 * 3. Scrape Retala with Category Dropdown & Pagination
 * URL: https://retala.com.ng/product-category/books/
 */
async function scrapeRetala(page, options = {}) {
  console.log("--> Scraping Retala catalog...");
  const books = [];
  
  try {
    console.log("   • Scraping books category with pagination...");
    await scrapeSingleRetalaPage(
      page,
      books,
      "https://retala.com.ng/product-category/books/",
      "Books",
      options
    );

  } catch (err) {
    console.warn("Retala scraper warning:", err.message);
  }
  
  return books;
}

/**
 * Helper: Scrape a single Retala page with pagination
 */
async function scrapeSingleRetalaPage(page, books, baseUrl, categoryName, options = {}) {
  try {
    const startPage = options.startPage || 1;
    for (let pageNum = startPage; pageNum <= MAX_PAGES_PER_CATEGORY; pageNum++) {
      let url = baseUrl;
      if (pageNum > 1) {
        url = baseUrl.includes("?") ? `${baseUrl}&paged=${pageNum}` : `${baseUrl}?paged=${pageNum}`;
      }
      
      console.log(`   • Page ${pageNum}/${MAX_PAGES_PER_CATEGORY}: ${categoryName}`);
      
      const pageLoaded = await visitCatalogPage(page, url, ".product, .type-product, article");
      if (!pageLoaded) {
        break;
      }

      const items = await page.$$eval(".product, .type-product, article", (elements) => {
        return elements.map((el) => {
          const titleEl = el.querySelector(".woocommerce-loop-product__title, .product-title, h2, h3");
          const priceEl = el.querySelector(".price, .amount");
          const authorEl = el.querySelector("[itemprop='author'], .product-author, .book-author, .author-name");
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector(".woocommerce-loop-product__title a, h2 a, h3 a, a[href*='/product/'], a[href]");

          return {
            title: titleEl ? titleEl.innerText.trim() : "",
            authorText: authorEl ? authorEl.innerText.trim() : "",
            priceText: priceEl ? priceEl.innerText.trim() : "",
            stockText: el.innerText.trim(),
            coverImage: imgEl ? (imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy-src") || imgEl.getAttribute("data-original") || imgEl.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0] || imgEl.getAttribute("src") || "") : "",
            sourceUrl: linkEl ? linkEl.href : ""
          };
        });
      });

      await addAuthorDetails(page, items);

      if (items.length === 0) {
        console.log(`   ⚠ No items found on page ${pageNum}, stopping pagination`);
        break;
      }

      const pageBooks = [];
      for (const item of items) {
        if (!isValidBookTitle(item.title) || !isValidProductUrl(item.sourceUrl)) continue;
        
        const vendorPrice = cleanPriceString(item.priceText);
        if (!vendorPrice) continue;
        const retailPrice = calculateRetailPrice(vendorPrice);
        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50);

        pageBooks.push({
          id: `retala-${pageNum}-${slug}`,
          title: item.title,
          author: cleanAuthor(item.authorText) || "Unknown Author",
          description: `Authentic literary edition of "${item.title}" sourced via Retala.`,
          coverImage: item.coverImage || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800",
          vendorPrice: vendorPrice,
          retailPrice: retailPrice,
          sourceVendor: "retala",
          sourceUrl: item.sourceUrl,
          category: classifyBookCategory({ ...item, category: categoryName }),
          inStock: parseStockStatus(item.stockText),
          rating: 4.8,
          updatedAt: new Date().toISOString()
        });
      }

      books.push(...pageBooks);

      if (options.onPageComplete) {
        await options.onPageComplete(pageNum, pageBooks);
      }
    }
  } catch (err) {
    console.warn(`Retala ${categoryName} page scraper warning:`, err.message);
  }
}

function persistCatalog(books) {
  const validBooks = books.filter((book) =>
    isValidBookTitle(book.title) && isValidProductUrl(book.sourceUrl)
  );
  const outputPath = path.join(__dirname, "../scraped_catalog.json");
  fs.writeFileSync(outputPath, JSON.stringify(validBooks, null, 2), "utf-8");

  const categoriesSet = new Set(validBooks.map((book) => book.category).filter(Boolean));
  const uniqueCategories = BOOK_CATEGORIES.filter((category) => categoriesSet.has(category));
  const filterPath = path.join(__dirname, "../lib/categoryFilters.json");
  fs.writeFileSync(filterPath, JSON.stringify({
    version: 1,
    lastUpdated: new Date().toISOString(),
    categories: uniqueCategories.map((category) => ({
      id: category.toLowerCase().replace(/\s+/g, "-"),
      name: category,
      count: validBooks.filter((book) => book.category === category).length
    }))
  }, null, 2), "utf-8");

  console.log(`✓ Checkpoint saved: ${validBooks.length} books`);
}

async function main() {
  console.log("=========================================");
  console.log("🚀 Starting Playwright Catalog Scraper...");
  console.log("🔄 Schedule: 2x per week (Mon/Thu)");
  console.log("📖 Max pages per category: " + MAX_PAGES_PER_CATEGORY);
  console.log(`🏪 Vendors: Rovingheights, Retala${SCRAPE_MASOBE ? ", Masobe" : ""}`);
  console.log("=========================================");

  let browser;
  try {
    let scrapedBooks = [];
    if (!SCRAPE_FRESH && fs.existsSync(path.join(__dirname, "../scraped_catalog.json"))) {
      try {
        scrapedBooks = JSON.parse(fs.readFileSync(path.join(__dirname, "../scraped_catalog.json"), "utf-8"))
          .filter((book) => isValidBookTitle(book.title) && isValidProductUrl(book.sourceUrl));
        console.log(`↻ Resuming from scraped_catalog.json: ${scrapedBooks.length} saved books`);
      } catch (error) {
        console.warn(`⚠ Could not read scraped_catalog.json; starting fresh: ${error.message}`);
      }
    } else if (SCRAPE_FRESH) {
      console.log("↻ Starting a fresh scrape; ignoring the existing catalog.");
    }

    const highestPage = (vendor, prefix = vendor) => scrapedBooks
      .filter((book) => book.sourceVendor === vendor)
      .map((book) => Number(book.id.match(new RegExp(`^${prefix}-(\\d+)-`))?.[1]) || 0)
      .reduce((highest, page) => Math.max(highest, page), 0);
    const rovingheightsNextPage = highestPage("rovingheights", "roving") + 1;
    const retalaNextPage = highestPage("retala") + 1;

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    if (SCRAPE_MASOBE && !scrapedBooks.some((book) => book.sourceVendor === "masoba")) {
      const masobeBooks = await scrapeMasoba(page);
      console.log(`✓ Masoba scraped: ${masobeBooks.length} items`);
      if (masobeBooks.length === 0) {
        throw new Error("Masobe returned zero books; keeping the previous checkpoint and stopping.");
      }
      scrapedBooks.push(...masobeBooks);
      persistCatalog(scrapedBooks);
    }

    if (rovingheightsNextPage <= MAX_PAGES_PER_CATEGORY) {
      const rovingBooks = await scrapeRovingheights(page, {
        startPage: rovingheightsNextPage,
        onPageComplete: async (pageNum, pageBooks) => {
          scrapedBooks.push(...pageBooks);
          persistCatalog(scrapedBooks);
        }
      });
      console.log(`✓ Rovingheights scraped: ${rovingBooks.length} items`);
      const savedRovingheightsBooks = scrapedBooks.filter(
        (book) => book.sourceVendor === "rovingheights"
      ).length;
      if (rovingBooks.length === 0 && savedRovingheightsBooks === 0) {
        throw new Error("Rovingheights returned zero books; keeping the previous checkpoint and stopping.");
      }
    }

    if (retalaNextPage <= MAX_PAGES_PER_CATEGORY) {
      const retalaBooks = await scrapeRetala(page, {
        startPage: retalaNextPage,
        onPageComplete: async (pageNum, pageBooks) => {
          scrapedBooks.push(...pageBooks);
          persistCatalog(scrapedBooks);
        }
      });
      console.log(`✓ Retala scraped: ${retalaBooks.length} items`);
      if (retalaBooks.length === 0) {
        throw new Error("Retala returned zero books; keeping the previous checkpoint and stopping.");
      }
    }

    persistCatalog(scrapedBooks);
    console.log("\n✅ Scraping complete. Run npm run seed when the catalog is ready.");
  } catch (error) {
    console.error("Scraping execution error:", error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  scrapeMasoba,
  scrapeRovingheights,
  scrapeRetala,
  scrapeSingleRetalaPage,
  calculateRetailPrice,
  cleanPriceString,
  parseStockStatus,
  isValidProductUrl,
  isValidBookTitle,
  visitCatalogPage,
  addAuthorDetails
};