import { NextApiRequest, NextApiResponse } from "next";

import { allowCors, handleOptions } from "@/lib/http";
import { getVendorByHostname } from "@/lib/marketplace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleOptions(req, res)) return;
  allowCors(res);

  const hostname = String(req.query.hostname ?? "");
  const vendor = hostname ? await getVendorByHostname(hostname) : null;

  if (!vendor) return res.status(404).json({ error: "Vendor domain not found" });

  return res.status(200).json({ vendor });
}
