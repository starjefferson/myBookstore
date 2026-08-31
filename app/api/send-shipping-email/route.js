import { NextResponse } from "next/server";
import { sendShippingNotificationEmail } from "../../../lib/resend";

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      orderId,
      buyerName,
      buyerEmail,
      trackingNumber,
      courierName,
      destinationState,
      shippingAddress,
      items,
      totalPaid
    } = body;

    // 1. Required Parameters Validation
    if (!orderId || !buyerEmail || !trackingNumber) {
      return NextResponse.json(
        { error: "orderId, buyerEmail, and trackingNumber are required" },
        { status: 400 }
      );
    }

    // 2. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return NextResponse.json(
        { error: "Invalid buyer email address format" },
        { status: 400 }
      );
    }

    // 3. Dispatch Shipping Notification Email via Resend Helper
    const result = await sendShippingNotificationEmail({
      orderId,
      buyerName: buyerName || "Valued Customer",
      buyerEmail: buyerEmail.trim(),
      trackingNumber: trackingNumber.trim(),
      courierName: courierName?.trim() || "Courier Dispatch",
      destinationState: destinationState || "Nigeria",
      shippingAddress: shippingAddress || "",
      items: Array.isArray(items) ? items : [],
      totalPaid: Number(totalPaid) || 0
    });

    return NextResponse.json({
      success: true,
      message: "Shipping notification email sent successfully",
      result
    });
  } catch (error) {
    console.error("API /api/send-shipping-email error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch shipping email" },
      { status: 500 }
    );
  }
}