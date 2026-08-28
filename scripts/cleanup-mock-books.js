const { loadEnvConfig } = require("@next/env");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

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

async function cleanup() {
  const db = getFirestore();
  const snapshot = await db.collection("books").get();
  const mockBooks = snapshot.docs;

  if (!mockBooks.length) {
    console.log("No book documents found.");
    return;
  }

  for (let index = 0; index < mockBooks.length; index += 450) {
    const batch = db.batch();
    mockBooks.slice(index, index + 450).forEach((book) => batch.delete(book.ref));
    await batch.commit();
  }
  console.log(`Deleted ${mockBooks.length} book documents.`);
}

cleanup().catch((error) => {
  console.error("Mock book cleanup failed:", error.message);
  process.exitCode = 1;
});
