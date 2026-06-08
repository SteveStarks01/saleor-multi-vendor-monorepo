import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import { AppExtension, AppManifest } from "@saleor/app-sdk/types";

import packageJson from "@/package.json";

import { orderCreatedWebhook } from "./webhooks/order-created";
import { orderFilterShippingMethodsWebhook } from "./webhooks/order-filter-shipping-methods";
import { shippingListMethodsForCheckoutWebhook } from "./webhooks/shipping-list-methods-for-checkout";

/**
 * App SDK helps with the valid Saleor App Manifest creation. Read more:
 * https://github.com/saleor/saleor-app-sdk/blob/main/docs/api-handlers.md#manifest-handler-factory
 */
export default createManifestHandler({
  async manifestFactory({ appBaseUrl, request, schemaVersion }) {
    /**
     * Allow to overwrite default app base url, to enable Docker support.
     *
     * See docs: https://docs.saleor.io/docs/3.x/developer/extending/apps/local-app-development
     */
    const iframeBaseUrl = process.env.APP_IFRAME_BASE_URL ?? appBaseUrl;
    const apiBaseURL = process.env.APP_API_BASE_URL ?? appBaseUrl;

    const extensionsForLatestSaleor: AppExtension[] = [
        {
          url: iframeBaseUrl + "/widgets/product-vendor-info",
          permissions: ["MANAGE_PRODUCTS"],
          mount: "PRODUCT_DETAILS_WIDGETS",
          label: "Vendor ownership",
          target: "WIDGET",
          options: {
            widgetTarget: {
              method: "GET",
            },
          },
        },
        {
          url: iframeBaseUrl + "/widgets/order-vendor-routing",
          permissions: ["MANAGE_ORDERS"],
          mount: "ORDER_DETAILS_WIDGETS",
          label: "Vendor routing",
          target: "WIDGET",
          options: {
            widgetTarget: {
              method: "GET",
            },
          },
        },
        {
          url: iframeBaseUrl + "/vendor-management",
          permissions: ["MANAGE_STAFF"],
          mount: "NAVIGATION_CATALOG",
          label: "Vendors",
          target: "APP_PAGE",
        },
        {
          url: iframeBaseUrl + "/vendor-dashboard",
          permissions: ["MANAGE_PRODUCTS"],
          mount: "NAVIGATION_CATALOG",
          label: "My Vendor Shop",
          target: "APP_PAGE",
        },
        {
          url: iframeBaseUrl + "/marketplace-analytics",
          permissions: ["MANAGE_ORDERS"],
          mount: "NAVIGATION_ORDERS",
          label: "Marketplace",
          target: "APP_PAGE",
        },
      ]

    const saleorMajor = schemaVersion && schemaVersion[0];
    const saleorMinor = schemaVersion && schemaVersion[1]

    const isAbove3_21 = (saleorMajor ?? 0) >= 3 && (saleorMinor ?? 0) >= 22;

    const extensions = isAbove3_21 ? extensionsForLatestSaleor : [];

    const manifest: AppManifest = {
      name: "Marketplace Platform Core",
      tokenTargetUrl: `${apiBaseURL}/api/register`,
      appUrl: iframeBaseUrl,
      /**
       * Set permissions for app if needed
       * https://docs.saleor.io/docs/3.x/developer/permissions
       */
      permissions: [
        "MANAGE_ORDERS",
        "MANAGE_PRODUCTS",
        "MANAGE_STAFF",
        "MANAGE_USERS",
        "MANAGE_CHANNELS",
        "MANAGE_SHIPPING",
        "MANAGE_CHECKOUTS",
      ],
      id: "marketplace.platform.core",
      version: packageJson.version,
      /**
       * Configure webhooks here. They will be created in Saleor during installation
       * Read more
       * https://docs.saleor.io/docs/3.x/developer/api-reference/webhooks/objects/webhook
       *
       * Easiest way to create webhook is to use app-sdk
       * https://github.com/saleor/saleor-app-sdk/blob/main/docs/saleor-webhook.md
       */
      webhooks: [
        orderCreatedWebhook.getWebhookManifest(apiBaseURL),
        shippingListMethodsForCheckoutWebhook.getWebhookManifest(apiBaseURL),
        orderFilterShippingMethodsWebhook.getWebhookManifest(apiBaseURL),
      ],
      /**
       * Optionally, extend Dashboard with custom UIs
       * https://docs.saleor.io/docs/3.x/developer/extending/apps/extending-dashboard-with-apps
       */
      extensions: extensions,
      author: "Marketplace Platform",
      brand: {
        logo: {
          default: `${apiBaseURL}/logo.png`,
        },
      },
    };

    return manifest;
  },
});
