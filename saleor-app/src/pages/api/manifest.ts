import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import { AppExtension, AppManifest } from "@saleor/app-sdk/types";

import packageJson from "@/package.json";

import { orderCreatedWebhook } from "./webhooks/order-created";
import { orderFilterShippingMethodsWebhook } from "./webhooks/order-filter-shipping-methods";
import { shippingListMethodsForCheckoutWebhook } from "./webhooks/shipping-list-methods-for-checkout";

import { transactionActionRequestWebhook } from "./webhooks/transaction-action-request";
import { transactionInitializeSessionWebhook } from "./webhooks/transaction-initialize-session";
import { transactionProcessSessionWebhook } from "./webhooks/transaction-process-session";

export default createManifestHandler({
  async manifestFactory({ appBaseUrl, request, schemaVersion }) {
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
      permissions: [
        "MANAGE_ORDERS",
        "MANAGE_PRODUCTS",
        "MANAGE_STAFF",
        "MANAGE_USERS",
        "MANAGE_CHANNELS",
        "MANAGE_SHIPPING",
        "MANAGE_CHECKOUTS",
        "HANDLE_PAYMENTS",
      ],
      id: "marketplace.platform.core",
      version: packageJson.version,
      webhooks: [
        orderCreatedWebhook.getWebhookManifest(apiBaseURL),
        shippingListMethodsForCheckoutWebhook.getWebhookManifest(apiBaseURL),
        orderFilterShippingMethodsWebhook.getWebhookManifest(apiBaseURL),
        transactionActionRequestWebhook.getWebhookManifest(apiBaseURL),
        transactionInitializeSessionWebhook.getWebhookManifest(apiBaseURL),
        transactionProcessSessionWebhook.getWebhookManifest(apiBaseURL),
      ],
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
