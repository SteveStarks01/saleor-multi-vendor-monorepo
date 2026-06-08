import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";

import {
  OrderCreatedSubscriptionDocument,
  OrderCreatedWebhookPayloadFragment,
} from "@/generated/graphql";
import { createClient } from "@/lib/create-graphq-client";
import { VENDOR_METADATA_KEYS, getVendorBySlug } from "@/lib/marketplace";
import { prisma } from "@/lib/prisma";
import { saleorApp } from "@/saleor-app";

/**
 * Create abstract Webhook. It decorates handler and performs security checks under the hood.
 *
 * orderCreatedWebhook.getWebhookManifest() must be called in api/manifest too!
 */
export const orderCreatedWebhook = new SaleorAsyncWebhook<OrderCreatedWebhookPayloadFragment>({
  name: "Order Created in Saleor",
  webhookPath: "api/webhooks/order-created",
  event: "ORDER_CREATED",
  apl: saleorApp.apl,
  query: OrderCreatedSubscriptionDocument,
});

/**
 * Export decorated Next.js pages router handler, which adds extra context
 */
export default orderCreatedWebhook.createHandler(async (req, res, ctx) => {
  const {
    /**
     * Access payload from Saleor - defined above
     */
    payload,
    /**
     * Saleor event that triggers the webhook (here - ORDER_CREATED)
     */
    event,
    /**
     * App's URL
     */
    baseUrl,
    /**
     * Auth data (from APL) - contains token and saleorApiUrl that can be used to construct graphQL client
     */
    authData,
  } = ctx;

  /**
   * Perform logic based on Saleor Event payload
   */
  console.log(`Order was created for customer: ${payload.order?.userEmail}`);

  /**
   * Create GraphQL client to interact with Saleor API.
   */
  const client = createClient(authData.saleorApiUrl, async () => ({ token: authData.token }));

  /**
   * Now you can fetch additional data using urql.
   * https://formidable.com/open-source/urql/docs/api/core/#clientquery
   */

  // const data = await client.query().toPromise()

  const order = payload.order;
  const linesByVendor = new Map<
    string,
    { lineIds: string[]; totalAmount: number; currency: string }
  >();

  for (const line of order?.lines ?? []) {
    const metadata = line.variant?.product?.metadata ?? [];
    const vendorSlug = metadata.find((item) => item.key === VENDOR_METADATA_KEYS.slug)?.value;
    if (!vendorSlug) continue;

    const gross = line.totalPrice.gross;
    const current = linesByVendor.get(vendorSlug) ?? {
      lineIds: [],
      totalAmount: 0,
      currency: gross.currency,
    };

    current.lineIds.push(line.id);
    current.totalAmount += gross.amount;
    current.currency = gross.currency;
    linesByVendor.set(vendorSlug, current);
  }

  for (const [vendorSlug, summary] of linesByVendor) {
    const vendor = await getVendorBySlug(vendorSlug);
    if (!vendor || !order) continue;

    await prisma.vendorOrder.upsert({
      where: {
        vendorId_saleorOrderId: {
          vendorId: vendor.id,
          saleorOrderId: order.id,
        },
      },
      create: {
        vendorId: vendor.id,
        saleorOrderId: order.id,
        orderNumber: order.number,
        totalAmount: summary.totalAmount,
        currency: summary.currency,
        lineIds: summary.lineIds,
      },
      update: {
        orderNumber: order.number,
        totalAmount: summary.totalAmount,
        currency: summary.currency,
        lineIds: summary.lineIds,
      },
    });
  }

  /**
   * Inform Saleor that webhook was delivered properly.
   */
  return res.status(200).end();
});

/**
 * Disable body parser for this endpoint, so signature can be verified
 */
export const config = {
  api: {
    bodyParser: false,
  },
};
