const { loadEnvConfig } = require("@next/env");
loadEnvConfig(".");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.trim().replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n")
          : undefined,
      }),
      storageBucket: "mybookstore-5caf3.appspot.com",
    });

const bucket = getStorage(app).bucket();

async function testUpload() {
  const file = bucket.file("test-connection.txt");
  await file.save("Firebase Storage test connection OK", {
    contentType: "text/plain",
    metadata: { cacheControl: "public, max-age=604800" },
  });
  console.log("Upload success to bucket:", bucket.name);
}

testUpload().catch((e) => console.error("Upload error:", e.message));
