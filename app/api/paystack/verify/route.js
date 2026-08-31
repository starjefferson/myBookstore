import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

const getAdminDb = () => {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return null;
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.trim().replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n")
        })
      });

  return getFirestore(app);
};

const getOrderId = (reference) => `ORD-${reference.replace(/[^a-zA-Z0-9_-]/g, "")}`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.json({ error: "Reference parameter is required" }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey || secretKey.includes("sk_test_xxxx")) {
    // Development fallback simulation
    return NextResponse.json({
      status: true,
      message: "Transaction verified successfully (Simulated mode)",
      data: {
        reference,
        status: "success",
        amount: 850000,
        currency: "NGN",
        paid_at: new Date().toISOString()
      }
    });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Paystack verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify transaction with Paystack" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const bodyText = await request.text();
    let body;

    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload received" }, { status: 400 });
    }

    // 1. HMAC Signature Verification for Paystack Webhook calls
    const paystackSignature = request.headers.get("x-paystack-signature");
    if (paystackSignature && secretKey) {
      const hash = crypto
        .createHmac("sha512", secretKey)
        .update(bodyText)
        .digest("hex");

      if (hash !== paystackSignature) {
        return NextResponse.json({ error: "Invalid Paystack HMAC signature" }, { status: 401 });
      }

      // Quick acknowledge for automated webhook ping
      if (body.event === "charge.success" && !body.order) {
        return NextResponse.json({
          success: true,
          message: "Webhook HMAC signature verified successfully",
          reference: body.data?.reference
        });
      }
    }

    // 2. Extract Reference & Order Data
    const reference = body.reference || body.data?.reference;
    const order = body.order || body.data?.metadata?.order;

    if (!reference || !order || !Number.isFinite(order.totalPaid) || order.totalPaid <= 0) {
      return NextResponse.json({ error: "A payment reference and valid order total are required" }, { status: 400 });
    }

    let transaction;

    if (!secretKey || secretKey.includes("sk_test_xxxx")) {
      transaction = {
        reference,
        status: "success",
        amount: Math.round(order.totalPaid * 100),
        paid_at: new Date().toISOString(),
        simulated: true
      };
    } else {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      const result = await response.json();
      transaction = result.data;
      if (!response.ok || !result.status) {
        return NextResponse.json({ error: result.message || "Paystack could not verify this payment" }, { status: 400 });
      }
    }

    if (transaction?.status !== "success") {
      return NextResponse.json({ error: "This Paystack transaction was not successful" }, { status: 400 });
    }

    // 3. Database Idempotency Check via Payment Receipts
    const db = getAdminDb();
    const receiptId = reference.replace(/[^a-zA-Z0-9_-]/g, "");
    const receiptRef = db?.collection("paymentReceipts").doc(receiptId);
    if (receiptRef) {
      const existingReceipt = await receiptRef.get();
      if (existingReceipt.exists) {
        return NextResponse.json({ success: true, order: existingReceipt.data().order });
      }
    }

    let verifiedItems = order.items;
    let verifiedSubtotal = order.bookSubtotal;
    let verifiedShippingFee = order.shippingFee;

    // 4. Server-Side Firestore Price & Zone Rate Verification
    if (db) {
      if (!Array.isArray(order.items) || order.items.length === 0 || !order.destinationState) {
        return NextResponse.json({ error: "Order items and destination state are required" }, { status: 400 });
      }

      const bookSnapshots = await Promise.all(
        order.items.map((item) => db.collection("books").doc(item.bookId).get())
      );
      if (bookSnapshots.some((book) => !book.exists)) {
        return NextResponse.json({ error: "One or more selected books are no longer available" }, { status: 400 });
      }

      verifiedItems = bookSnapshots.map((book, index) => {
        const data = book.data();
        const quantity = Number(order.items[index].quantity || 1);
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error("Each book quantity must be at least one");
        }
        return {
          bookId: book.id,
          title: data.title,
          quantity,
          retailPrice: data.retailPrice,
          vendorPrice: data.vendorPrice || data.retailPrice,
          sourceVendor: data.sourceVendor,
          sourceUrl: data.sourceUrl || ""
        };
      });

      const zones = await db.collection("shippingZones")
        .where("state", "==", order.destinationState)
        .limit(1)
        .get();

      if (zones.empty) {
        return NextResponse.json({ error: "The selected delivery destination is unavailable" }, { status: 400 });
      }

      verifiedSubtotal = verifiedItems.reduce(
        (total, item) => total + item.retailPrice * item.quantity,
        0
      );
      verifiedShippingFee = zones.docs[0].data().fee;
    }

    const verifiedTotal = verifiedSubtotal + verifiedShippingFee;
    if (
      transaction.reference !== reference ||
      transaction.amount !== Math.round(verifiedTotal * 100) ||
      order.totalPaid !== verifiedTotal
    ) {
      return NextResponse.json({ error: "The verified payment does not match this checkout" }, { status: 400 });
    }

    const confirmedOrder = {
      ...order,
      items: verifiedItems,
      bookSubtotal: verifiedSubtotal,
      shippingFee: verifiedShippingFee,
      totalPaid: verifiedTotal,
      id: getOrderId(reference),
      paymentReference: reference,
      paystackRef: reference,
      paymentVerifiedAt: transaction.paid_at || new Date().toISOString(),
      status: "paid",
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 5. Atomic Order Creation via Firestore Transaction
    if (db) {
      const orderRef = db.collection("orders").doc(confirmedOrder.id);
      const savedOrder = await db.runTransaction(async (firestoreTransaction) => {
        const receipt = await firestoreTransaction.get(receiptRef);
        if (receipt.exists) return receipt.data().order;

        firestoreTransaction.set(orderRef, confirmedOrder, { merge: true });
        firestoreTransaction.set(receiptRef, {
          reference,
          orderId: confirmedOrder.id,
          order: confirmedOrder,
          verifiedAt: confirmedOrder.paymentVerifiedAt
        });
        return confirmedOrder;
      });
      return NextResponse.json({ success: true, order: savedOrder });
    }

    return NextResponse.json({ success: true, order: confirmedOrder, simulated: true });
  } catch (error) {
    console.error("Paystack confirmation error:", error);
    return NextResponse.json({ error: "Unable to confirm this payment. Please try again." }, { status: 500 });
  }
}