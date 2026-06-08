import { NextApiRequest, NextApiResponse } from "next";

import { allowCors, handleOptions } from "@/lib/http";
import {
  buildWhatsappCheckoutMessage,
  buildWhatsappUrl,
  getSingleVendorCheckout,
  recordMarketplacePaymentIntent,
  type CheckoutSummary,
} from "@/lib/marketplace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleOptions(req, res)) return;
  allowCors(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { kind, checkout } = req.body as { kind?: "COD" | "WHATSAPP"; checkout?: CheckoutSummary };

  if (!kind || !checkout) {
    return res.status(400).json({ error: "Missing checkout intent payload" });
  }

  try {
    if (kind === "COD") {
      const intent = await recordMarketplacePaymentIntent(checkout, "COD");
      return res.status(201).json({ intent });
    }

    const vendor = getSingleVendorCheckout(checkout);
    if (!vendor) {
      return res.status(400).json({ error: "WhatsApp checkout requires products from one vendor." });
    }

    const message = buildWhatsappCheckoutMessage(checkout);
    const intent = await recordMarketplacePaymentIntent(checkout, "WHATSAPP", message);

    return res.status(201).json({
      intent,
      whatsappUrl: buildWhatsappUrl(vendor.whatsapp ?? "", message),
      message,
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Checkout intent failed" });
  }
}
