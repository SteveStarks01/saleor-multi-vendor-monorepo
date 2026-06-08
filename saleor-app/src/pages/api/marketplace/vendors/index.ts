import { NextApiRequest, NextApiResponse } from "next";

import { allowCors, handleOptions } from "@/lib/http";
import { createVendor, listVendors } from "@/lib/marketplace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleOptions(req, res)) return;
  allowCors(res);

  try {
    if (req.method === "GET") {
      const vendors = await listVendors({ activeOnly: req.query.active === "true" });
      return res.status(200).json({ vendors });
    }

    if (req.method === "POST") {
      const vendor = await createVendor(req.body);
      return res.status(201).json({ vendor });
    }

    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Vendor request failed" });
  }
}
