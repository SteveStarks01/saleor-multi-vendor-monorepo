import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const { shopName, email, whatsappNumber, description } = req.body;

      if (!shopName || !email) {
        return res.status(400).json({ error: "shopName and email are required" });
      }

      const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

      const vendor = await prisma.vendor.create({
        data: {
          slug,
          shopName,
          email,
          whatsappNumber,
          description,
          status: "PENDING",
        },
      });

      res.status(201).json({ vendor });
    } catch (error) {
      console.error("Error creating vendor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "GET") {
    try {
      const vendors = await prisma.vendor.findMany({
        where: {
          status: "ACTIVE",
        },
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
      res.status(200).json({ vendors });
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
