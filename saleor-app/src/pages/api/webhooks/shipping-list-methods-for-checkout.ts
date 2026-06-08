import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";

import {
  ShippingListMethodsForCheckoutPayloadFragment,
  ShippingListMethodsForCheckoutSubscriptionDocument,
} from "@/generated/graphql";
import { VENDOR_METADATA_KEYS, getVendorBySlug } from "@/lib/marketplace";
import { saleorApp } from "@/saleor-app";

type ExternalShippingMethod = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  minimum_delivery_days?: number;
  maximum_delivery_days?: number;
  description?: string;
  metadata?: Record<string, string>;
};

export const shippingListMethodsForCheckoutWebhook =
  new SaleorSyncWebhook<ShippingListMethodsForCheckoutPayloadFragment>({
    name: "Marketplace Shipping Methods for Checkout",
    webhookPath: "api/webhooks/shipping-list-methods-for-checkout",
    event: "SHIPPING_LIST_METHODS_FOR_CHECKOUT",
    apl: saleorApp.apl,
    query: ShippingListMethodsForCheckoutSubscriptionDocument,
  });

export default shippingListMethodsForCheckoutWebhook.createHandler(async (req, res, ctx) => {
  const checkout = ctx.payload.checkout;
  const currency = checkout?.currency;
  const vendorSlugs = new Set<string>();

  for (const line of checkout?.lines ?? []) {
    const metadata = line.variant?.product?.metadata ?? [];
    const vendorSlug = metadata.find((item) => item.key === VENDOR_METADATA_KEYS.slug)?.value;
    if (vendorSlug) vendorSlugs.add(vendorSlug);
  }

  const methods: ExternalShippingMethod[] = [];

  for (const vendorSlug of vendorSlugs) {
    const vendor = await getVendorBySlug(vendorSlug);
    if (!vendor) continue;

    for (const provider of vendor.shippingProviders) {
      if (!provider.isEnabled || provider.currency !== currency) continue;

      methods.push({
        id: `${vendor.slug}:${provider.providerSlug}:${provider.serviceName}`.toLowerCase(),
        name: `${vendor.shopName} - ${provider.providerName} ${provider.serviceName}`,
        amount: Number(provider.basePrice),
        currency: provider.currency,
        minimum_delivery_days: provider.minDays ?? undefined,
        maximum_delivery_days: provider.maxDays ?? undefined,
        description: `Marketplace shipping for ${vendor.shopName}`,
        metadata: {
          vendorSlug: vendor.slug,
          providerSlug: provider.providerSlug,
        },
      });
    }
  }

  return res.status(200).json(methods);
});

export const config = {
  api: {
    bodyParser: false,
  },
};
