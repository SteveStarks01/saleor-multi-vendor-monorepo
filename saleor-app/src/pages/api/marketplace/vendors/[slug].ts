import { NextApiRequest, NextApiResponse } from "next";

import { allowCors, handleOptions } from "@/lib/http";
import { addVendorDomain, getVendorBySlug, updateVendor } from "@/lib/marketplace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleOptions(req, res)) return;
  allowCors(res);

  const slug = String(req.query.slug ?? "");

  try {
    if (req.method === "GET") {
      const vendor = await getVendorBySlug(slug);
      if (!vendor) return res.status(404).json({ error: "Vendor not found" });
      return res.status(200).json({ vendor });
    }

    if (req.method === "PUT") {
      const vendor = await updateVendor(slug, req.body);
      return res.status(200).json({ vendor });
    }

    if (req.method === "POST" && req.body?.hostname) {
      const domain = await addVendorDomain(slug, req.body.hostname);
      return res.status(201).json({ domain });
    }

    res.setHeader("Allow", "GET,PUT,POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Vendor request failed" });
  }
}
