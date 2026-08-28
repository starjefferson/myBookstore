import { NextResponse } from "next/server";
import { INITIAL_BOOKS, INITIAL_ORDERS } from "../../../lib/mockData";
import { SHIPPING_ZONES } from "../../../lib/zones";
import { db, isLiveFirebaseConfigured } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function POST() {
  try {
    let firestoreCount = 0;

    if (isLiveFirebaseConfigured && db) {
      // Seed Shipping Zones
      for (const zone of SHIPPING_ZONES) {
        const zoneId = `zone_${zone.state.toLowerCase().replace(/\s+/g, "_")}`;
        await setDoc(doc(db, "shippingZones", zoneId), zone, { merge: true });
        firestoreCount++;
      }

      // Seed Initial Books
      for (const book of INITIAL_BOOKS) {
        await setDoc(doc(db, "books", book.id), book, { merge: true });
        firestoreCount++;
      }

      // Seed Initial Sample Orders
      for (const order of INITIAL_ORDERS) {
        await setDoc(doc(db, "orders", order.id), order, { merge: true });
        firestoreCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database seed successful",
      seeded: {
        booksCount: INITIAL_BOOKS.length,
        zonesCount: SHIPPING_ZONES.length,
        ordersCount: INITIAL_ORDERS.length,
        firestoreRecordsWritten: firestoreCount,
        isLiveFirebase: isLiveFirebaseConfigured
      }
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
