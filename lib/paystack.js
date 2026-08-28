// Paystack Inline Checkout Helper

export const getPaystackPublicKey = () => {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_d3m0k3y00000000000000000000000000000000";
};

export const isLivePaystackConfigured = () => {
  const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  return Boolean(key && !key.includes("d3m0k3y") && key.startsWith("pk_"));
};

/**
 * Loads Paystack Popup script dynamically
 */
export const loadPaystackScript = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.PaystackPop) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      // Fallback to legacy inline script if v2 has issues
      const fallbackScript = document.createElement("script");
      fallbackScript.src = "https://js.paystack.co/v1/inline.js";
      fallbackScript.async = true;
      fallbackScript.onload = () => resolve(true);
      fallbackScript.onerror = () => reject(new Error("Failed to load Paystack SDK"));
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  });
};

/**
 * Trigger Paystack Inline Popup payment
 */
export const initializePaystackPayment = async ({
  email,
  amount, // In NGN
  reference,
  metadata = {},
  onSuccess,
  onCancel,
  onError
}) => {
  try {
    const isScriptLoaded = await loadPaystackScript();

    const amountInKobo = Math.round(amount * 100);
    const publicKey = getPaystackPublicKey();

    // If running in development/demo without live keys, allow interactive simulation
    if (!isLivePaystackConfigured() && (!window.PaystackPop || !window.Paystack)) {
      console.log("[Paystack Demo Mode] Simulating payment transaction:", { amount, email, reference });
      
      const simulateSuccess = window.confirm(
        `[Paystack Test Simulation]\n\nAmount: ₦${amount.toLocaleString()}\nEmail: ${email}\nRef: ${reference}\n\nClick OK to simulate Successful Payment, or Cancel to simulate Declined payment.`
      );

      if (simulateSuccess) {
        if (onSuccess) {
          onSuccess({
            reference: reference || `ps_sim_${Date.now()}`,
            status: "success",
            trans: `sim_trans_${Date.now()}`,
            message: "Approved (Simulation)"
          });
        }
      } else {
        if (onCancel) onCancel();
      }
      return;
    }

    if (window.PaystackPop) {
      const popup = new window.PaystackPop();
      popup.newTransaction({
        key: publicKey,
        email: email,
        amount: amountInKobo,
        currency: "NGN",
        ref: reference,
        metadata: metadata,
        onSuccess: (transaction) => {
          if (onSuccess) onSuccess(transaction);
        },
        onCancel: () => {
          if (onCancel) onCancel();
        }
      });
    } else if (window.Paystack) {
      // Legacy handler
      const handler = window.Paystack.setup({
        key: publicKey,
        email: email,
        amount: amountInKobo,
        currency: "NGN",
        ref: reference,
        metadata: metadata,
        callback: function (response) {
          if (onSuccess) onSuccess(response);
        },
        onClose: function () {
          if (onCancel) onCancel();
        }
      });
      handler.openIframe();
    }
  } catch (err) {
    console.error("Paystack Checkout Error:", err);
    if (onError) onError(err);
  }
};
