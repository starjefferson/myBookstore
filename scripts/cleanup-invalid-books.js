const { loadEnvConfig } = require("@next/env");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");
const { isValidProductUrl, isValidBookTitle } = require("./scrape");

loadEnvConfig(path.join(__dirname, ".."));

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ?.trim()
        .replace(/^['"]|['"]$/g, "")
        .replace(/\\n/g, "\n")
    })
  });
}

async function cleanupInvalidBooks() {
  const db = getFirestore();
  const snapshot = await db.collection("books").get();
  const invalidBooks = snapshot.docs.filter((book) => {
    const data = book.data();
    return !isValidBookTitle(data.title) || !isValidProductUrl(data.sourceUrl);
  });

  if (!invalidBooks.length) {
    console.log("No invalid book records found.");
    return;
  }

  for (let start = 0; start < invalidBooks.length; start += 450) {
    const batch = db.batch();
    invalidBooks.slice(start, start + 450).forEach((book) => batch.delete(book.ref));
    await batch.commit();
  }

  console.log(`Deleted ${invalidBooks.length} invalid book records.`);
}

cleanupInvalidBooks().catch((error) => {
  console.error("Invalid book cleanup failed:", error.message);
  process.exitCode = 1;
});
