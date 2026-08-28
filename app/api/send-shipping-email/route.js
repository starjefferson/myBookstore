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

    if (!orderId || !buyerEmail || !trackingNumber) {
      return NextResponse.json(
        { error: "orderId, buyerEmail, and trackingNumber are required" },
        { status: 400 }
      );
    }

    const result = await sendShippingNotificationEmail({
      orderId,
      buyerName,
      buyerEmail,
      trackingNumber,
      courierName: courierName || "Courier Dispatch",
      destinationState,
      shippingAddress,
      items,
      totalPaid
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
