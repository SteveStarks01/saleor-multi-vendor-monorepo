import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { checkoutId, kind, vendorId, amount, currency } = req.body;

  try {
    const paymentIntent = await prisma.marketplacePaymentIntent.create({
      data: {
        saleorCheckoutId: checkoutId,
        kind,
        vendorId,
        amount,
        currency,
        status: "PENDING",
      },
    });

    res.status(200).json(paymentIntent);
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
