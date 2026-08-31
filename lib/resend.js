// Resend Transactional Email Helper for Order Fulfillment & Tracking
import { Resend } from "resend";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes("re_xxxx")) {
    return null;
  }
  return new Resend(apiKey);
};

export const generateTrackingEmailHtml = ({
  buyerName,
  orderId,
  trackingNumber,
  courierName,
  destinationState,
  shippingAddress,
  items,
  totalPaid
}) => {
  const itemsHtml = (items || [])
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #27272a;">
        <td style="padding: 12px 0; color: #f4f4f5; font-size: 14px;">
          <strong>${item.title}</strong>
          <div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">
            Qty: ${item.quantity || 1} &bull; Sourced via ${item.sourceVendor === 'masobe' ? 'Masobe Books' : 'Rovingheights'}
          </div>
        </td>
        <td style="padding: 12px 0; text-align: right; color: #34d399; font-weight: 600; font-size: 14px;">
          ₦${(((item.retailPrice || item.price || 0) * (item.quantity || 1))).toLocaleString()}
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Books are On The Way!</title>
    </head>
    <body style="background-color: #090a0f; color: #e4e4e7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px 16px;">
      <table align="center" width="100%" max-width="600" style="max-width: 600px; background-color: #12131a; border: 1px solid #27272a; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <!-- Header -->
        <tr>
          <td style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #27272a;">
            <div style="display: inline-block; background: #0284c7; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase;">
              Digital Concierge Bookstore
            </div>
            <h1 style="color: #ffffff; font-size: 24px; margin: 20px 0 8px 0;">📦 Your Order is In Transit!</h1>
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Hi ${buyerName || "Bibliophile"}, your books have been sourced, packaged, and handed over to our verified courier.</p>
          </td>
        </tr>

        <!-- Tracking Banner -->
        <tr>
          <td style="padding: 24px 0;">
            <div style="background-color: #181a24; border: 1px solid #0284c7; border-radius: 8px; padding: 20px; text-align: center;">
              <div style="font-size: 12px; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.1em; font-weight: 600; margin-bottom: 6px;">
                Shipment Tracking Code
              </div>
              <div style="font-family: monospace, Courier, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">
                ${trackingNumber}
              </div>
              <div style="color: #94a3b8; font-size: 13px; margin-top: 8px;">
                Dispatched via <strong>${courierName || "Verified Courier"}</strong>
              </div>
            </div>
          </td>
        </tr>

        <!-- Delivery Details -->
        <tr>
          <td style="padding-bottom: 20px;">
            <h3 style="color: #f4f4f5; font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">
              Destination Details
            </h3>
            <div style="background: #181a24; border: 1px solid #27272a; border-radius: 8px; padding: 14px; font-size: 14px; color: #d4d4d8;">
              <div><strong>Address:</strong> ${shippingAddress || "Provided during checkout"}</div>
              <div style="margin-top: 4px;"><strong>State / Zone:</strong> ${destinationState || "Nigeria"}</div>
              <div style="margin-top: 4px;"><strong>Order ID:</strong> <span style="font-family: monospace;">#${orderId}</span></div>
            </div>
          </td>
        </tr>

        <!-- Order Items -->
        <tr>
          <td style="padding-bottom: 24px;">
            <h3 style="color: #f4f4f5; font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">
              Package Contents
            </h3>
            <table width="100%" style="border-collapse: collapse;">
              ${itemsHtml}
              <tr>
                <td style="padding: 14px 0 0 0; color: #a1a1aa; font-size: 14px; font-weight: 600;">Total Paid (Incl. Zone Shipping):</td>
                <td style="padding: 14px 0 0 0; text-align: right; color: #34d399; font-weight: 700; font-size: 16px;">₦${(totalPaid || 0).toLocaleString()}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Concierge Footer Note -->
        <tr>
          <td style="border-top: 1px solid #27272a; padding-top: 20px; text-align: center; color: #71717a; font-size: 12px; line-height: 1.5;">
            <p style="margin: 0 0 8px 0;">Thank you for ordering with Digital Concierge Bookstore.</p>
            <p style="margin: 0;">Our concierge team personally manages and coordinates your orders directly with Masobe Books and Rovingheights for genuine, pristine physical editions.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const sendShippingNotificationEmail = async (orderData) => {
  const resend = getResendClient();
  const rawFromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const toEmail = orderData.buyerEmail;

  if (!toEmail) {
    throw new Error("Buyer email is required to send shipping notification");
  }

  // Format sender email safely to avoid invalid double angle brackets
  const fromEmail = rawFromEmail.includes("<")
    ? rawFromEmail
    : `Digital Concierge <${rawFromEmail}>`;

  // Development simulation mode when RESEND_API_KEY is not configured
  if (!resend) {
    console.log("[Resend Dev Mode] Shipping email dispatch simulated for:", {
      to: toEmail,
      from: fromEmail,
      orderId: orderData.orderId,
      trackingNumber: orderData.trackingNumber,
      courierName: orderData.courierName
    });
    return {
      success: true,
      simulated: true,
      id: `sim_email_${Date.now()}`,
      message: "Email dispatch simulated (RESEND_API_KEY not configured)"
    };
  }

  try {
    const html = generateTrackingEmailHtml(orderData);

    const response = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `📦 Your Order #${orderData.orderId} is In Transit! (${orderData.courierName} - ${orderData.trackingNumber})`,
      html: html
    });

    return {
      success: true,
      data: response
    };
  } catch (error) {
    console.error("Resend API Email Dispatch Failure:", error);
    throw new Error(`Resend email delivery failed: ${error.message}`);
  }
};