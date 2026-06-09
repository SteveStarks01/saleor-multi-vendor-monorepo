import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;

  if (typeof slug !== "string") {
    return res.status(400).json({ message: "Invalid vendor slug" });
  }

  if (req.method === "GET") {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          shopName: true,
          description: true,
          logoUrl: true,
          whatsappNumber: true,
          codEnabled: true,
          whatsappCheckoutEnabled: true,
        },
      });

      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      res.status(200).json({ vendor });
    } catch (error) {
      console.error("Error fetching vendor:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
