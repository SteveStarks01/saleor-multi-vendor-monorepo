import { NextApiResponse } from "next";

export function allowCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.STOREFRONT_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function handleOptions(req: { method?: string }, res: NextApiResponse) {
  if (req.method !== "OPTIONS") return false;
  allowCors(res);
  res.status(204).end();
  return true;
}
