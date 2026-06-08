# Saleor Multi-Vendor Marketplace — Comprehensive Technical Implementation Guide v2

> **Re-Evaluated:** Dashboard reuse strategy, payment-agnostic architecture, external shipping provider platform  
> **Target Stack:** Saleor Core 3.23, saleor-dashboard 3.23, saleor-storefront (Next.js 16), Saleor App SDK  
> **Local:** `localhost:8000` (API) · `localhost:9000` (Dashboard) · `localhost:3001` (Storefront)

---

## Table of Contents

1. [Architecture Re-Evaluation Summary](#1-architecture-re-evaluation-summary)
2. [System Map — All Actors & Dashboards](#2-system-map)
3. [Dashboard Strategy — Reusing Saleor Dashboard UI/UX](#3-dashboard-strategy)
4. [Data Model & Channel Architecture](#4-data-model)
5. [Phase 1 — Platform Core App (Vendor + Admin Management)](#5-phase-1-platform-core-app)
6. [Phase 2 — Saleor Dashboard Extensions (Vendor + Admin Views)](#6-phase-2-dashboard-extensions)
7. [Phase 3 — Shipping Service Platform](#7-phase-3-shipping-platform)
8. [Phase 4 — Payment Gateway (Provider-Agnostic)](#8-phase-4-payments)
9. [Phase 5 — Central Marketplace Storefront](#9-phase-5-central-storefront)
10. [Phase 6 — Individual Vendor Storefronts](#10-phase-6-vendor-storefronts)
11. [Phase 7 — Order Routing & Fulfillment](#11-phase-7-orders)
12. [Permissions & Role Matrix](#12-permissions--roles)
13. [Deployment Architecture](#13-deployment)
14. [Implementation Checklist (8 Weeks)](#14-implementation-checklist)

---

## 1. Architecture Re-Evaluation Summary

### 1.1 What Changed

| Topic | Previous Approach | Revised Approach |
|---|---|---|
| **Vendor Dashboard** | Custom iframe UI built from scratch | **Reuse Saleor Dashboard** with App Extensions + channel scoping |
| **Admin Dashboard** | Saleor Dashboard as-is | Saleor Dashboard + App Extensions for marketplace-specific admin views |
| **Payments** | Stripe Connect | **Payment-agnostic** via Saleor Transaction API (pluggable gateway apps) |
| **Shipping** | Saleor built-in methods | **External Shipping Service Platform** via `SHIPPING_LIST_METHODS_FOR_CHECKOUT` sync webhook |

### 1.2 Core Design Principles (Revised)

1. **Never fork Saleor Core or Dashboard** — extend only via Apps and App Extensions
2. **One Channel per Vendor** — Saleor's native isolation mechanism
3. **Saleor Dashboard as the shared UI shell** — vendors and admins both use `localhost:9000`, role/channel scoped
4. **Shipping is a marketplace-level service** — external providers expose rates via webhook; vendors subscribe to providers
5. **Payment is pluggable** — custom Transaction App handles any payment processor without coupling

---

## 2. System Map

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         PLATFORM ACTORS & PORTALS                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧑‍💼 PLATFORM ADMIN                                                           │
│   URL: localhost:9000  (Saleor Dashboard + Marketplace Admin App Extension) │
│   Sees: All vendors, all orders, all products, all shipping providers       │
│   Can: Create/suspend vendors, approve products, manage shipping providers  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏪 VENDOR (Staff User with restricted permissions)                          │
│   URL: localhost:9000  (Same Saleor Dashboard — channel-scoped)             │
│   Sees: Their products, their orders, their channel, their shipping options │
│   Can: Manage products, fulfill orders, choose shipping providers           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚛 SHIPPING PROVIDER (External Company)                                     │
│   URL: localhost:4000  (Shipping Provider Portal — standalone Next.js app)  │
│   Sees: Their service areas, rates, active deliveries, earnings             │
│   Can: Set shipping zones, rates, vehicle types, pickup points, schedule    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛍️ CUSTOMER                                                                 │
│   URL: localhost:3001 (Central Marketplace) OR vendor.marketplace.com       │
│   Sees: All vendors' products (central) OR single vendor's shop             │
│   Can: Browse, buy, select shipping provider at checkout                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dashboard Strategy — Reusing Saleor Dashboard UI/UX

### 3.1 The Key Insight: Saleor Dashboard Already Supports Multi-Role Access

The Saleor Dashboard at `localhost:9000` is a **single React SPA** that adapts its UI based on:
- The logged-in user's **staff permissions**
- Available **App Extensions** (extra navigation items, modals, full-page views)
- **Channel context** (all views can be pre-filtered to a channel)

This means **vendors and platform admins can both use the same Dashboard URL** with completely different experiences — no fork, no duplicate codebase.

### 3.2 How It Works: App Extensions

Saleor Dashboard App Extensions (from 3.22+) support 4 targets:

| Target | How it renders | Best for |
|---|---|---|
| `POPUP` | Modal iframe (medium size) | Quick actions, confirmations |
| `APP_PAGE` | Full-page iframe in `/apps/` section | Rich vendor dashboard views |
| `WIDGET` | Small embedded iframe on existing pages | Vendor stats on product/order pages |
| `NEW_TAB` | Opens in new browser tab | External tools, reports |

**Mounting points** cover almost every section of the Dashboard:
- `NAVIGATION_CATALOG`, `NAVIGATION_ORDERS`, `NAVIGATION_CUSTOMERS`
- `PRODUCT_DETAILS_MORE_ACTIONS`, `ORDER_DETAILS_MORE_ACTIONS`
- `PRODUCT_DETAILS_WIDGETS`, `ORDER_DETAILS_WIDGETS` (stats, inline tools)

### 3.3 Vendor Dashboard — Delivered via App Extensions

When a vendor staff user logs in, they see:

```
Saleor Dashboard (localhost:9000)
├── Catalogue        → Products (pre-filtered to vendor's Channel)
│   └── [WIDGET] Vendor Product Stats (from Marketplace Core App)
├── Orders           → Orders (pre-filtered to vendor's Warehouse)
│   └── [WIDGET] Vendor Revenue Summary (from Marketplace Core App)
├── Shipping         → Shipping (vendor selects their providers)
│   └── [APP_PAGE] "My Shipping Providers" (Shipping Platform App Extension)
├── [NAVIGATION] My Vendor Shop  → [APP_PAGE] vendor profile editor
└── [NAVIGATION] Earnings        → [APP_PAGE] earnings & payouts dashboard
```

**How channel scoping works:**  
When a vendor is created, their staff account has permissions only for their Channel. Saleor Dashboard auto-filters all lists (products, orders, etc.) to the user's accessible channels. No code change to Dashboard is needed.

### 3.4 Platform Admin Dashboard — Extended via App Extensions

The super admin sees everything PLUS vendor-management views injected by the Marketplace Core App:

```
Saleor Dashboard (localhost:9000)
├── [Standard Saleor navigation — full access]
├── [NAVIGATION] Vendors          → [APP_PAGE] Vendor List & Management
│   ├── Vendor create/edit
│   ├── Onboarding status
│   └── Channel & warehouse assignment
├── [NAVIGATION] Shipping Providers → [APP_PAGE] Provider Registry
│   ├── Approve/suspend providers
│   ├── Commission rates
│   └── Coverage maps
└── [NAVIGATION] Marketplace Analytics → [APP_PAGE] Cross-vendor analytics
```

### 3.5 macaw-ui — The Saleor Design System

App Extension pages (iframes) should use **macaw-ui** (Saleor's open-source design system) to look identical to the Dashboard:

```bash
npm install @saleor/macaw-ui
```

```tsx
// In your App Extension page — matches Dashboard look exactly
import { Box, Text, Button, Input, DataGrid } from "@saleor/macaw-ui";
import "@saleor/macaw-ui/style";

export default function VendorDashboard() {
  return (
    <Box padding={6}>
      <Text variant="title" size="large">My Vendor Dashboard</Text>
      <DataGrid columns={columns} rows={orders} />
    </Box>
  );
}
```

This gives the vendor's dashboard views the **exact same visual language** as the rest of Saleor Dashboard — colors, typography, data grids, form controls, modals — all consistent.

---

## 4. Data Model & Channel Architecture

### 4.1 One Channel per Vendor

```
Platform "default-channel"   → Central marketplace (all products published here too)
vendor-acme-electronics       → Acme Electronics vendor channel
vendor-tech-gear-hub          → Tech Gear Hub vendor channel
vendor-fashion-forward        → Fashion Forward vendor channel
```

Each vendor channel has:
- Its own **currency** (can differ per vendor)
- Its own **warehouse** (vendor's stock)
- Its own **shipping zone** (shipping providers assigned here)
- Its own **price list** (vendors set their own prices)

### 4.2 Vendor Entity (Stored in Saleor Metadata + App Database)

```
User (Saleor staff account)
  └── privateMetadata:
        vendor_id:          "v_abc123"
        vendor_slug:        "acme-electronics"
        vendor_channel_id:  "Q2hhbm5lbDox"
        vendor_channel_slug:"vendor-acme-electronics"
        warehouse_id:       "V2FyZWhvdXNlOjE="
        shop_name:          "Acme Electronics"
        shop_description:   "..."
        logo_url:           "https://..."
        is_active:          "true"
        onboarding_step:    "complete"    # pending | profile | payment | complete
```

### 4.3 Shipping Provider Entity (Stored in Shipping Platform App DB)

```prisma
model ShippingProvider {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  email           String   @unique
  phone           String?
  logoUrl         String?
  description     String?
  isActive        Boolean  @default(false)   // admin must approve
  isVerified      Boolean  @default(false)
  apiKey          String   @unique           // for their portal login
  webhookSecret   String                     // for rate callbacks
  
  services        ShippingService[]
  zones           ShippingZone[]
  createdAt       DateTime @default(now())
}

model ShippingService {
  id              String   @id @default(cuid())
  providerId      String
  provider        ShippingProvider @relation(...)
  
  name            String   // "Standard Delivery", "Express", "Same Day"
  slug            String   // "standard", "express", "same-day"
  description     String?
  
  // Service capabilities
  supportsPickup  Boolean  @default(false)
  supportsDropoff Boolean  @default(true)
  maxWeightKg     Float?
  maxDimensionsCm Json?    // { length, width, height }
  
  rates           ShippingRate[]
}

model ShippingRate {
  id              String   @id @default(cuid())
  serviceId       String
  service         ShippingService @relation(...)
  
  // Rate definition
  zoneSlug        String   // which geographic zone
  basePrice       Float    // base rate in platform currency
  pricePerKg      Float    // additional per kg
  currency        String   @default("USD")
  estimatedDays   Int?     // min estimated delivery
  estimatedDaysMax Int?    // max estimated delivery
  
  isActive        Boolean  @default(true)
  updatedAt       DateTime @updatedAt
}

model VendorShippingProvider {
  vendorSlug      String
  providerId      String
  provider        ShippingProvider @relation(...)
  isEnabled       Boolean @default(true)
  // Vendor can configure custom pickup address
  pickupAddress   Json?
  
  @@unique([vendorSlug, providerId])
}
```

### 4.4 Payment Agnostic (Transaction App DB)

```prisma
model PaymentTransaction {
  id              String   @id @default(cuid())
  saleorOrderId   String   // Saleor Order ID
  saleorCheckoutId String?
  vendorSlug      String
  
  amount          Float
  currency        String
  status          String   // pending | authorized | charged | refunded | failed
  
  // Gateway-agnostic fields
  gatewayName     String   // "bank_transfer" | "mobile_money" | "local_card" | custom
  gatewayTxId     String?  // external reference
  gatewayResponse Json?    // raw response from payment provider
  
  platformFee     Float    @default(0)
  vendorPayout    Float    @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 5. Phase 1 — Platform Core App (Vendor + Admin Management)

This is the central Saleor App (built on top of the existing `saleor-app` template) that:
- Manages vendor creation (User + Channel + Warehouse)
- Exposes API for all other apps and the storefront
- Registers App Extensions in the Dashboard
- Handles `ORDER_CREATED` webhooks for order routing

### 5.1 App Structure

```
saleor-app/
├── src/
│   ├── pages/
│   │   ├── api/
│   │   │   ├── manifest.ts              # App manifest with extensions
│   │   │   ├── vendors/
│   │   │   │   ├── index.ts             # GET list, POST create
│   │   │   │   └── [slug].ts            # GET, PUT, DELETE
│   │   │   └── webhooks/
│   │   │       ├── order-created.ts
│   │   │       └── order-fulfilled.ts
│   │   ├── vendor-management/           # APP_PAGE extension — admin
│   │   │   ├── index.tsx                # Vendor list
│   │   │   └── [vendorId].tsx           # Vendor detail
│   │   ├── vendor-dashboard/            # APP_PAGE extension — vendor self-service
│   │   │   ├── index.tsx                # Vendor home/analytics
│   │   │   ├── earnings.tsx             # Earnings & payout history
│   │   │   └── profile.tsx              # Shop profile editor
│   │   └── marketplace-analytics/       # APP_PAGE extension — admin analytics
│   └── lib/
│       ├── vendor.ts                    # Vendor CRUD logic
│       ├── channel.ts                   # Channel creation helpers
│       └── prisma.ts                    # Prisma client
```

### 5.2 App Manifest with Extensions

```typescript
// src/pages/api/manifest.ts
export default function manifest(req, res) {
  res.json({
    id: "marketplace.platform.core",
    version: "1.0.0",
    name: "Marketplace Platform Core",
    permissions: [
      "MANAGE_USERS",
      "MANAGE_CHANNELS",
      "MANAGE_PRODUCTS",
      "MANAGE_ORDERS",
      "MANAGE_SHIPPING",
      "MANAGE_STAFF",
    ],
    appUrl: `${process.env.APP_URL}`,
    tokenTargetUrl: `${process.env.APP_URL}/api/register`,
    webhooks: [
      {
        name: "Order Created — Vendor Routing",
        asyncEvents: ["ORDER_CREATED"],
        targetUrl: `${process.env.APP_URL}/api/webhooks/order-created`,
        isActive: true,
      },
    ],
    extensions: [
      // ─── ADMIN EXTENSIONS ───────────────────────────────────────────────
      {
        label: "Vendor Management",
        mount: "NAVIGATION_CATALOG",          // appears in left nav
        target: "APP_PAGE",
        permissions: ["MANAGE_STAFF"],        // admin only
        url: "/vendor-management",
      },
      {
        label: "Marketplace Analytics",
        mount: "NAVIGATION_ORDERS",
        target: "APP_PAGE",
        permissions: ["MANAGE_ORDERS", "MANAGE_STAFF"],
        url: "/marketplace-analytics",
      },
      // ─── VENDOR EXTENSIONS ──────────────────────────────────────────────
      {
        label: "My Vendor Shop",
        mount: "NAVIGATION_CATALOG",          // vendor sees this too
        target: "APP_PAGE",
        permissions: ["MANAGE_PRODUCTS"],
        url: "/vendor-dashboard",
      },
      {
        label: "My Earnings",
        mount: "NAVIGATION_ORDERS",
        target: "APP_PAGE",
        permissions: ["MANAGE_ORDERS"],
        url: "/vendor-dashboard/earnings",
      },
      // ─── WIDGET EXTENSIONS ──────────────────────────────────────────────
      {
        label: "Vendor Info",
        mount: "PRODUCT_DETAILS_WIDGETS",     // shows on product pages
        target: "WIDGET",
        permissions: ["MANAGE_PRODUCTS"],
        url: "/widgets/product-vendor-info",
        options: { widgetTarget: { method: "GET" } },
      },
      {
        label: "Order Vendor Details",
        mount: "ORDER_DETAILS_WIDGETS",
        target: "WIDGET",
        permissions: ["MANAGE_ORDERS"],
        url: "/widgets/order-vendor-routing",
        options: { widgetTarget: { method: "GET" } },
      },
    ],
  });
}
```

### 5.3 Vendor Creation Flow

```typescript
// src/pages/api/vendors/index.ts — POST
async function createVendor(data) {
  const { shop_name, email, description, address } = data;
  const slug = slugify(shop_name, { lower: true });

  // 1. Create staff user in Saleor
  const user = await saleorClient.mutation(STAFF_USER_CREATE, {
    input: { email, firstName: shop_name, isStaff: true, sendPasswordEmail: true }
  });

  // 2. Create Channel for this vendor
  const channel = await saleorClient.mutation(CHANNEL_CREATE, {
    input: {
      name: shop_name,
      slug: `vendor-${slug}`,
      currencyCode: "USD",
      defaultCountry: "US",
      isActive: true,
    }
  });

  // 3. Create Warehouse for this vendor
  const warehouse = await saleorClient.mutation(WAREHOUSE_CREATE, {
    input: {
      name: `${shop_name} Warehouse`,
      slug: `${slug}-warehouse`,
      address,
      shippingZones: [],
    }
  });

  // 4. Assign warehouse to channel
  await saleorClient.mutation(WAREHOUSE_CHANNEL_ASSIGN, {
    id: warehouse.id,
    input: [channel.id]
  });

  // 5. Restrict staff user to vendor channel
  await saleorClient.mutation(PERMISSION_GROUP_CREATE, {
    input: {
      name: `${shop_name} Vendors`,
      addPermissions: ["MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_SHIPPING"],
      addUsers: [user.id],
      restrictedAccessToChannels: true,
      addChannels: [channel.id],
    }
  });

  // 6. Tag vendor metadata on user
  await saleorClient.mutation(UPDATE_PRIVATE_METADATA, {
    id: user.id,
    input: [
      { key: "vendor_id", value: cuid() },
      { key: "vendor_slug", value: slug },
      { key: "vendor_channel_id", value: channel.id },
      { key: "vendor_channel_slug", value: `vendor-${slug}` },
      { key: "warehouse_id", value: warehouse.id },
      { key: "shop_name", value: shop_name },
      { key: "description", value: description || "" },
      { key: "onboarding_step", value: "profile" },
      { key: "is_active", value: "true" },
    ]
  });

  // 7. Store in Platform Core App DB
  await prisma.vendor.create({
    data: {
      slug,
      shopName: shop_name,
      email,
      saleorUserId: user.id,
      saleorChannelId: channel.id,
      saleorWarehouseId: warehouse.id,
    }
  });

  return { slug, channelSlug: `vendor-${slug}` };
}
```

---

## 6. Phase 2 — Saleor Dashboard Extensions (Vendor + Admin Views)

### 6.1 Vendor Management Page (Admin)

Built using **macaw-ui** for visual consistency with Saleor Dashboard:

```tsx
// src/pages/vendor-management/index.tsx
import { Box, Text, DataGrid, Button, Badge } from "@saleor/macaw-ui";
import { AppBridge, AppBridgeProvider } from "@saleor/app-sdk/app-bridge";

export default function VendorManagementPage() {
  const { appBridgeState } = useAppBridge();
  const vendors = useVendors(appBridgeState.token);

  return (
    <AppBridgeProvider>
      <Box padding={6}>
        <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={6}>
          <Text variant="title" size="large">Vendor Management</Text>
          <Button variant="primary" onClick={() => router.push("/vendor-management/new")}>
            Add Vendor
          </Button>
        </Box>

        <DataGrid
          columns={[
            { field: "shopName", headerName: "Shop Name" },
            { field: "email", headerName: "Email" },
            { field: "products", headerName: "Products" },
            { field: "orders", headerName: "Orders" },
            {
              field: "status",
              headerName: "Status",
              renderCell: (row) => (
                <Badge color={row.isActive ? "success" : "error"}>
                  {row.isActive ? "Active" : "Suspended"}
                </Badge>
              )
            },
          ]}
          rows={vendors}
          onRowClick={(row) => router.push(`/vendor-management/${row.id}`)}
        />
      </Box>
    </AppBridgeProvider>
  );
}
```

### 6.2 Vendor Self-Service Dashboard Page

The vendor sees their own analytics using the same macaw-ui design:

```tsx
// src/pages/vendor-dashboard/index.tsx
export default function VendorDashboard() {
  // AppBridge gives us the current user's token + saleorApiUrl
  const { appBridgeState } = useAppBridge();
  
  // Determine which vendor this is from their user metadata
  const { vendor, stats } = useCurrentVendor(appBridgeState.token);

  return (
    <Box padding={6} display="grid" gridTemplateColumns={3} gap={6}>
      {/* Summary cards — same style as Saleor Dashboard home */}
      <StatCard label="This Month's Revenue" value={stats.revenue} />
      <StatCard label="Pending Orders" value={stats.pendingOrders} />
      <StatCard label="Active Products" value={stats.activeProducts} />

      {/* Recent orders table */}
      <Box gridColumn="span 3">
        <Text variant="title" size="medium" marginBottom={4}>Recent Orders</Text>
        <VendorOrdersTable vendorSlug={vendor.slug} token={appBridgeState.token} />
      </Box>
    </Box>
  );
}
```

### 6.3 AppBridge Communication

The App Extension (iframe) communicates with the Dashboard shell:

```typescript
import { AppBridge } from "@saleor/app-sdk/app-bridge";

const appBridge = new AppBridge();

// Redirect parent Dashboard to a Saleor route
appBridge.dispatch({
  type: "redirect",
  payload: { to: "/products/", newContext: false }
});

// Show a notification in Dashboard
appBridge.dispatch({
  type: "notification",
  payload: { status: "success", title: "Vendor saved successfully" }
});

// Get the current Dashboard theme (dark/light) for styling
appBridge.getState().then(state => {
  console.log(state.theme); // "dark" | "light"
});
```

---

## 7. Phase 3 — Shipping Service Platform

This is the most novel component — a multi-sided platform where external shipping companies register, configure their services, and vendors subscribe to use them.

### 7.1 How It Works End-to-End

```
1. Shipping Provider registers via Provider Portal (localhost:4000)
2. Platform Admin approves provider
3. Provider sets: zones, rates, services (pickup, delivery, express, etc.)
4. Vendor selects which providers serve their Channel
5. At checkout, Saleor fires SHIPPING_LIST_METHODS_FOR_CHECKOUT webhook
6. Shipping Platform App responds with available rates from vendor's providers
7. Customer sees and selects a shipping method
8. On ORDER_CREATED, Shipping Platform notifies the relevant provider
```

### 7.2 The Saleor Shipping Webhook Integration

Saleor 3.x has a **synchronous shipping webhook** `SHIPPING_LIST_METHODS_FOR_CHECKOUT` — when Saleor needs shipping methods for a checkout, it calls the app's endpoint and expects a list of methods back in real time.

```typescript
// src/pages/api/webhooks/shipping-list-methods.ts
export default async function shippingListMethods(req, res) {
  // Verify Saleor webhook signature
  const { checkout } = parseWebhookPayload(req);
  
  // Determine which vendor's channel this checkout belongs to
  const channelSlug = checkout.channel.slug;
  const vendorSlug = channelSlug.replace("vendor-", "");
  
  // Get all shipping providers this vendor has enabled
  const vendorProviders = await prisma.vendorShippingProvider.findMany({
    where: { vendorSlug, isEnabled: true },
    include: {
      provider: {
        include: { services: { include: { rates: true } } }
      }
    }
  });
  
  // Resolve customer's delivery zone from checkout address
  const deliveryZone = resolveZone(checkout.shippingAddress);
  
  // Build list of available shipping methods for this checkout
  const shippingMethods = [];
  
  for (const vp of vendorProviders) {
    for (const service of vp.provider.services) {
      const rate = service.rates.find(r => 
        r.zoneSlug === deliveryZone && r.isActive
      );
      
      if (!rate) continue;
      
      // Calculate final price (base + weight-based)
      const totalWeightKg = checkout.lines.reduce((sum, line) => 
        sum + (line.variant.weight?.value || 0) * line.quantity, 0
      );
      const price = rate.basePrice + (totalWeightKg * rate.pricePerKg);
      
      shippingMethods.push({
        id: `${vp.provider.slug}-${service.slug}`,   // Saleor encodes this
        name: `${vp.provider.name} — ${service.name}`,
        amount: price,
        currency: rate.currency,
        maximum_delivery_days: service.estimatedDaysMax,
        minimum_delivery_days: service.estimatedDays,
        description: service.description,
        metadata: {                                   // Extra data for the frontend
          provider_slug: vp.provider.slug,
          service_slug: service.slug,
          provider_logo: vp.provider.logoUrl,
          supports_pickup: service.supportsPickup,
        }
      });
    }
  }
  
  // Return methods — Saleor will merge with any internally configured methods
  res.json(shippingMethods);
}
```

### 7.3 Also Register Filter Webhook (Optional)

The `CHECKOUT_FILTER_SHIPPING_METHODS` webhook lets you remove specific shipping methods based on business rules:

```typescript
// Exclude express shipping for very heavy/large items
export async function filterShippingMethods(checkout, availableMethods) {
  const totalWeight = checkout.lines.reduce((sum, l) => 
    sum + (l.variant.weight?.value || 0) * l.quantity, 0
  );
  
  return availableMethods.filter(method => {
    if (totalWeight > 30 && method.id.includes("express")) return false;
    return true;
  });
}
```

### 7.4 Shipping Provider Portal (Standalone Next.js App)

```
saleor-shipping-platform/       ← New project at localhost:4000
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Provider dashboard shell
│   │   │   ├── overview/page.tsx       # Stats: deliveries, earnings, ratings
│   │   │   ├── services/
│   │   │   │   ├── page.tsx            # List services
│   │   │   │   └── [serviceId]/page.tsx # Edit service + rates
│   │   │   ├── zones/page.tsx          # Geographic coverage
│   │   │   ├── rates/page.tsx          # Rate management per zone
│   │   │   ├── deliveries/page.tsx     # Active deliveries
│   │   │   ├── pickup-points/page.tsx  # Pickup location management
│   │   │   └── settings/page.tsx       # Provider profile, bank details
│   └── api/
│       ├── providers/[slug]/rates.ts   # Called by Shipping Webhook handler
│       └── auth/[...nextauth].ts
```

### 7.5 Shipping Provider Dashboard Features

| Section | Features |
|---|---|
| **Overview** | Today's deliveries, pending pickups, monthly earnings, ratings |
| **Services** | Create/edit delivery services (Standard, Express, Same Day, Pickup) |
| **Zones** | Define coverage areas (city, region, country) with map UI |
| **Rates** | Set prices per zone per service, weight surcharges, fuel surcharges |
| **Pickup Points** | Manage physical pickup locations with addresses and hours |
| **Deliveries** | View assigned deliveries, update status, track exceptions |
| **Settings** | Company profile, bank account for payouts, API configuration |

### 7.6 Shipping Provider Registration in Saleor Dashboard

The Shipping Platform App also adds an extension to the Saleor Dashboard for the Platform Admin:

```json
{
  "label": "Shipping Providers",
  "mount": "NAVIGATION_CATALOG",
  "target": "APP_PAGE",
  "permissions": ["MANAGE_SHIPPING", "MANAGE_STAFF"],
  "url": "/shipping-admin"
}
```

Admin views inside this extension:
- **Provider Registry** — list, approve, suspend shipping companies
- **Commission rates** — set platform commission per provider/service
- **Coverage map** — see which areas are covered
- **Dispute resolution** — handle lost/damaged shipment claims

### 7.7 Vendor Selects Shipping Providers

Inside the Vendor Dashboard App Extension:

```tsx
// "My Shipping Providers" page for vendors
export default function VendorShippingPage() {
  const { vendor } = useCurrentVendor();
  const { providers } = useApprovedProviders(); // All approved providers
  const { vendorProviders } = useVendorProviders(vendor.slug); // Vendor's selected ones

  return (
    <Box padding={6}>
      <Text variant="title">Shipping Providers for My Shop</Text>
      <Text color="secondary">
        Select which shipping companies can deliver your orders.
        Customers will see these options at checkout.
      </Text>
      
      {providers.map(provider => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          isEnabled={vendorProviders.some(vp => vp.providerId === provider.id)}
          onToggle={() => toggleProvider(vendor.slug, provider.id)}
        />
      ))}
    </Box>
  );
}
```

---

## 8. Phase 4 — Payment Gateway (Provider-Agnostic)

### 8.1 Saleor Transaction API (the Modern Payment Pattern)

Saleor 3.x uses the **Transaction API** via synchronous webhooks for payments — completely payment-processor-agnostic:

| Webhook | Fired when | App responds with |
|---|---|---|
| `TRANSACTION_INITIALIZE_SESSION` | Checkout payment starts | Payment form / redirect URL |
| `TRANSACTION_PROCESS_SESSION` | Customer submits payment | Success / failure |
| `TRANSACTION_CHARGE_REQUESTED` | Order fulfilled → release funds | Charge confirmation |
| `TRANSACTION_REFUND_REQUESTED` | Refund initiated | Refund status |

### 8.2 Payment App Architecture

The Payment App is a separate Saleor App that wraps any payment provider:

```
saleor-payment-app/
├── src/
│   ├── pages/api/
│   │   ├── manifest.ts
│   │   └── webhooks/
│   │       ├── transaction-initialize.ts
│   │       ├── transaction-process.ts
│   │       ├── transaction-charge.ts
│   │       └── transaction-refund.ts
│   ├── gateways/
│   │   ├── gateway.interface.ts    # Common interface all gateways implement
│   │   ├── bank-transfer.ts        # Bank transfer gateway
│   │   ├── mobile-money.ts         # Mobile money gateway
│   │   ├── local-card.ts           # Local card processor
│   │   └── manual.ts               # Manual payment (admin confirms)
│   └── lib/
│       ├── commission.ts           # Platform fee calculation
│       └── payout.ts               # Vendor payout scheduling
```

### 8.3 Gateway Interface (Add Any Payment Provider)

```typescript
// src/gateways/gateway.interface.ts
export interface PaymentGateway {
  name: string;
  
  /**
   * Initialize a payment session — return whatever the frontend needs
   * (redirect URL, payment form data, QR code, etc.)
   */
  initialize(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerId: string;
    metadata: Record<string, string>;
  }): Promise<{
    data: Record<string, unknown>;  // Returned to checkout frontend
    pspReference: string;           // Provider's transaction ID
  }>;

  /**
   * Process the payment after customer action
   */
  process(params: {
    pspReference: string;
    data: Record<string, unknown>;  // From customer (form submission, callback)
  }): Promise<{
    result: "CHARGE_SUCCESS" | "CHARGE_FAILURE" | "PENDING";
    pspReference: string;
    amount: number;
  }>;

  /**
   * Capture/charge the payment (after fulfillment if needed)
   */
  charge(transactionId: string, amount: number): Promise<{ pspReference: string }>;

  /**
   * Refund a payment
   */
  refund(transactionId: string, amount: number): Promise<{ pspReference: string }>;
}
```

### 8.4 Platform Commission Logic

The Payment App handles commission without any specific payment provider SDK:

```typescript
// src/lib/commission.ts
export function calculateCommission(orderTotal: number, vendorSlug: string) {
  // Get vendor-specific commission rate (stored in vendor metadata)
  const commissionRate = getVendorCommissionRate(vendorSlug) || 0.10; // Default 10%
  
  const platformFee = orderTotal * commissionRate;
  const vendorPayout = orderTotal - platformFee;
  
  return { platformFee, vendorPayout, commissionRate };
}

// Track payouts in the Payment App DB
export async function scheduleVendorPayout(orderId: string, vendorSlug: string) {
  const order = await getOrderFromSaleor(orderId);
  const { platformFee, vendorPayout } = calculateCommission(order.total, vendorSlug);
  
  await prisma.paymentTransaction.create({
    data: {
      saleorOrderId: orderId,
      vendorSlug,
      amount: order.total,
      currency: order.currency,
      status: "charged",
      platformFee,
      vendorPayout,
      gatewayName: order.paymentMethod,
    }
  });
  
  // Notify payout system (cron job or manual — your payment provider's transfer)
}
```

### 8.5 Adding a New Payment Provider

To add a new payment method, implement the `PaymentGateway` interface:

```typescript
// src/gateways/bank-transfer.ts
export const bankTransferGateway: PaymentGateway = {
  name: "bank_transfer",
  
  async initialize({ amount, currency, orderId }) {
    // Generate bank account details + reference number
    const reference = `PAY-${orderId.slice(-8).toUpperCase()}`;
    return {
      pspReference: reference,
      data: {
        bankName: "National Bank",
        accountNumber: "1234-5678-9012",
        sortCode: "12-34-56",
        reference,
        amount,
        currency,
        expiresAt: addHours(new Date(), 48).toISOString(),
      }
    };
  },
  
  async process({ pspReference, data }) {
    // Check if payment was confirmed (webhook from bank or admin confirmation)
    const confirmed = await checkBankTransferStatus(pspReference);
    return {
      result: confirmed ? "CHARGE_SUCCESS" : "PENDING",
      pspReference,
      amount: data.amount as number,
    };
  },
  
  async charge(transactionId, amount) {
    // Already charged at process time for bank transfers
    return { pspReference: transactionId };
  },
  
  async refund(transactionId, amount) {
    await initiateManualRefund(transactionId, amount);
    return { pspReference: `REF-${transactionId}` };
  }
};
```

---

## 9. Phase 5 — Central Marketplace Storefront

The `saleor-storefront` at `localhost:3001` is the central hub where all vendors' products appear.

### 9.1 New Routes to Add

```
src/app/[channel]/(main)/
├── page.tsx                    # Homepage — featured vendors + products
├── products/                   # All products (cross-vendor)
├── vendors/                    # [NEW]
│   ├── page.tsx                # Vendor directory (grid of shops)
│   └── [vendorSlug]/
│       ├── page.tsx            # Vendor shop page
│       └── [productSlug]/
│           └── page.tsx        # Product detail inside vendor shop
├── categories/                 # Cross-vendor category browse
└── search/                     # Cross-vendor search
```

### 9.2 Cross-Vendor Product Feed Strategy

Products must be published in BOTH:
- `vendor-{slug}` channel (for the vendor's own storefront)
- `default-channel` (to appear in the central marketplace)

The vendor metadata on each product identifies its owner:

```typescript
// src/lib/marketplace.ts
export async function getMarketplaceProducts(first: number, after?: string) {
  const result = await executePublicGraphQL(ProductListDocument, {
    variables: {
      channel: "default-channel",
      first,
      after,
      filter: { isPublished: true }
    }
  });
  
  if (!result.ok) return [];
  
  return result.data.products.edges.map(({ node }) => ({
    ...node,
    vendor: {
      slug: node.privateMetadata.find(m => m.key === "vendor_slug")?.value,
      name: node.privateMetadata.find(m => m.key === "shop_name")?.value,
    }
  }));
}
```

### 9.3 Vendor Directory Page

```tsx
// src/app/[channel]/(main)/vendors/page.tsx
export default async function VendorsPage() {
  const vendors = await fetch(`${process.env.PLATFORM_APP_URL}/api/vendors`)
    .then(r => r.json());

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shop by Vendor</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {vendors.map(vendor => (
          <VendorCard key={vendor.slug} vendor={vendor} />
        ))}
      </div>
    </main>
  );
}
```

### 9.4 Shipping Provider Info at Checkout

Show available shipping providers on the checkout page (uses Saleor's native `shippingMethods` which now includes external methods from the webhook):

```tsx
// src/checkout/ShippingStep.tsx — the shippingMethods already contain external providers
{checkout.shippingMethods.map(method => {
  const providerLogo = method.metadata?.find(m => m.key === "provider_logo")?.value;
  const supportsPickup = method.metadata?.find(m => m.key === "supports_pickup")?.value === "true";
  
  return (
    <ShippingMethodOption key={method.id} method={method}>
      {providerLogo && <img src={providerLogo} alt="" className="h-6 w-auto" />}
      <span>{method.name}</span>
      <span>{formatMoney(method.price)}</span>
      {supportsPickup && <Badge>Pickup Available</Badge>}
    </ShippingMethodOption>
  );
})}
```

---

## 10. Phase 6 — Individual Vendor Storefronts

### 10.1 Subdomain Routing via Next.js Middleware

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "localhost:3001";

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";
  const subdomain = hostname.split(".")[0];
  
  // vendor.marketplace.com → rewrite to /vendor-acme/vendors/acme
  if (hostname !== PLATFORM_DOMAIN && hostname !== `www.${PLATFORM_DOMAIN}`) {
    const url = req.nextUrl.clone();
    url.pathname = `/vendor-${subdomain}/vendors/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }
  
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
```

### 10.2 Vendor-Themed Layout

```tsx
// src/app/[channel]/(main)/vendors/[vendorSlug]/layout.tsx
export default async function VendorShopLayout({ children, params }) {
  const vendor = await getVendorProfile(params.vendorSlug);
  
  // Read theme from vendor metadata
  const themeConfig = JSON.parse(
    vendor.metadata.find(m => m.key === "storefront_config")?.value || "{}"
  );
  
  return (
    <div
      style={{
        "--brand-primary": themeConfig.primaryColor || "#2563eb",
        "--brand-accent": themeConfig.accentColor || "#7c3aed",
      } as React.CSSProperties}
    >
      <VendorTopBanner vendor={vendor} />
      <VendorNav vendor={vendor} />
      <main>{children}</main>
      <VendorFooter vendor={vendor} />
    </div>
  );
}
```

---

## 11. Phase 7 — Order Routing & Fulfillment

### 11.1 Order Flow Diagram

```
Customer checks out → Saleor creates Order
                         │
                         ▼ ORDER_CREATED webhook
                    Platform Core App
                         │
                         ├── Tag each OrderLine with vendor_id metadata
                         ├── Notify relevant vendor (email/dashboard)
                         ├── Record in VendorOrder DB table
                         └── Notify relevant shipping provider
                               │
                               ▼ Shipping Provider Portal
                          Provider assigns driver / creates shipment
                               │
                               ▼ Provider updates delivery status
                          Platform Core App receives status webhook
                               │
                               ▼ Creates Saleor Fulfillment
                               └── Customer notified
```

### 11.2 Order-Created Webhook Handler

```typescript
// src/pages/api/webhooks/order-created.ts
export async function orderCreatedHandler(order) {
  // Group order lines by vendor
  const linesByVendor = new Map();
  
  for (const line of order.lines) {
    const vendorSlug = line.variant.product.privateMetadata
      .find(m => m.key === "vendor_slug")?.value;
    
    if (!vendorSlug) continue;
    
    if (!linesByVendor.has(vendorSlug)) linesByVendor.set(vendorSlug, []);
    linesByVendor.get(vendorSlug).push(line);
  }
  
  // For each vendor involved in this order
  for (const [vendorSlug, lines] of linesByVendor) {
    const subtotal = lines.reduce((sum, l) => sum + l.totalPrice.gross.amount, 0);
    
    // Store vendor-order mapping
    await prisma.vendorOrder.create({
      data: {
        orderId: order.id,
        orderNumber: order.number,
        vendorSlug,
        lineIds: lines.map(l => l.id),
        status: "pending",
        totalAmount: subtotal,
        currency: order.currency,
      }
    });
    
    // Tag lines with vendor metadata in Saleor
    for (const line of lines) {
      await updatePrivateMetadata(line.id, [
        { key: "vendor_slug", value: vendorSlug },
        { key: "fulfillment_status", value: "pending" }
      ]);
    }
    
    // Notify vendor via email
    await sendVendorOrderNotification(vendorSlug, order, lines);
    
    // Notify shipping provider (if assigned)
    await notifyShippingProvider(order, vendorSlug, lines);
  }
}
```

---

## 12. Permissions & Roles

### 12.1 Complete Role Matrix

| Actor | Saleor Permissions | Channel Access | Dashboard Views |
|---|---|---|---|
| **Platform Admin** | ALL | All channels | Full Saleor Dashboard + all App Extensions |
| **Vendor Owner** | MANAGE_PRODUCTS, MANAGE_ORDERS, MANAGE_SHIPPING | Own channel only | Products (own), Orders (own), Shipping, Vendor Dashboard App Extension |
| **Vendor Staff** | MANAGE_PRODUCTS | Own channel only | Products (own) only |
| **Shipping Provider** | None (Saleor) | N/A | Provider Portal only (`localhost:4000`) |
| **Customer** | None | All public channels | Storefront only |

### 12.2 How Channel Scoping Works in Dashboard

When a staff user with `restrictedAccessToChannels: true` logs in:
- Product list → shows only products in their channel
- Order list → shows only orders from their channel's checkouts
- Shipping → shows shipping zones for their channel only

**This is built into Saleor 3.x — no Dashboard modification needed.**

---

## 13. Deployment Architecture

### 13.1 Local Development Ports

| Service | Port | Description |
|---|---|---|
| Saleor Core API | 8000 | GraphQL API + Admin API |
| Saleor Dashboard | 9000 | Admin + Vendor Dashboard |
| Platform Core App | 3000 | Main marketplace Saleor App |
| Central Storefront | 3001 | Main marketplace frontend |
| Shipping Platform App | 3002 | Shipping Saleor App |
| Shipping Provider Portal | 4000 | Shipping company portal |
| Payment App | 3003 | Payment Saleor App |
| PostgreSQL | 5432 | Saleor + App databases |
| Redis/Valkey | 6379 | Saleor cache |
| Mailpit | 8025 | Email testing |

### 13.2 Three Saleor Apps Required

```
1. Platform Core App (localhost:3000)
   - Vendor CRUD + onboarding
   - Dashboard Extensions: Vendor Management, Vendor Dashboard, Analytics
   - Webhooks: ORDER_CREATED, ORDER_FULFILLED

2. Shipping Platform App (localhost:3002)
   - External shipping methods registry
   - Dashboard Extension: Shipping Provider management
   - Webhooks: SHIPPING_LIST_METHODS_FOR_CHECKOUT (sync), 
               CHECKOUT_FILTER_SHIPPING_METHODS (sync)

3. Payment App (localhost:3003)
   - Pluggable payment gateway
   - Webhooks: TRANSACTION_INITIALIZE_SESSION (sync),
               TRANSACTION_PROCESS_SESSION (sync),
               TRANSACTION_CHARGE_REQUESTED (sync)
```

### 13.3 Environment Variables

#### Platform Core App
```env
APP_URL=http://localhost:3000
NEXT_PUBLIC_SALEOR_API_URL=http://localhost:8000/graphql/
DATABASE_URL=postgresql://saleor:saleor@localhost:5432/platform_core
SECRET_KEY=...
```

#### Shipping Platform App
```env
APP_URL=http://localhost:3002
NEXT_PUBLIC_SALEOR_API_URL=http://localhost:8000/graphql/
DATABASE_URL=postgresql://saleor:saleor@localhost:5432/shipping_platform
SHIPPING_PORTAL_URL=http://localhost:4000
```

#### Shipping Provider Portal
```env
NEXT_PUBLIC_API_URL=http://localhost:3002/api
DATABASE_URL=postgresql://saleor:saleor@localhost:5432/shipping_platform
```

---

## 14. Implementation Checklist (8 Weeks)

### Week 1 — Platform Foundation
- [ ] Extend `saleor-app` as Platform Core App
- [ ] Set up Prisma schema (Vendor, VendorOrder tables)
- [ ] Implement `POST /api/vendors` — creates User + Channel + Warehouse + Permission Group
- [ ] Implement `GET /api/vendors`, `GET /api/vendors/[slug]`
- [ ] Write App manifest with all extensions
- [ ] Install and test App registration in Saleor Dashboard at localhost:9000

### Week 2 — Dashboard Extensions (Admin Views)
- [ ] Install `@saleor/macaw-ui` in Platform Core App
- [ ] Build Vendor List page using macaw-ui DataGrid
- [ ] Build Vendor Create/Edit page using macaw-ui forms
- [ ] Build Marketplace Analytics page
- [ ] Test AppBridge communication (notifications, redirects)
- [ ] Verify admin can see all extensions

### Week 3 — Dashboard Extensions (Vendor Views)
- [ ] Build Vendor Self-Service Dashboard page (stats, recent orders)
- [ ] Build Vendor Earnings page
- [ ] Build Vendor Shop Profile editor
- [ ] Build Product Vendor Info widget (embedded in product pages)
- [ ] Test channel-scoping: vendor user sees only their data
- [ ] Test permission group: vendor cannot access admin-only features

### Week 4 — Shipping Platform App
- [ ] Create `saleor-shipping-app` project
- [ ] Design Prisma schema (ShippingProvider, ShippingService, ShippingRate, ShippingZone)
- [ ] Implement `SHIPPING_LIST_METHODS_FOR_CHECKOUT` webhook handler
- [ ] Implement `CHECKOUT_FILTER_SHIPPING_METHODS` webhook handler
- [ ] Register Shipping App in Saleor Dashboard
- [ ] Add "Shipping Provider Management" Dashboard Extension (admin view)
- [ ] Add "My Shipping Providers" Dashboard Extension (vendor view)
- [ ] End-to-end test: checkout returns external shipping methods

### Week 5 — Shipping Provider Portal
- [ ] Create `saleor-shipping-portal` Next.js project at port 4000
- [ ] Build provider registration + login flow
- [ ] Build Services management page (CRUD)
- [ ] Build Zones management page
- [ ] Build Rates configuration page (per zone + per service)
- [ ] Build Pickup Points management
- [ ] Build Deliveries tracking view
- [ ] Seed two test shipping providers
- [ ] Vendor selects providers in Dashboard Extension → checkout shows their rates

### Week 6 — Payment App
- [ ] Create `saleor-payment-app` project at port 3003
- [ ] Implement `PaymentGateway` interface
- [ ] Implement `bank-transfer` gateway
- [ ] Implement `manual` gateway (admin confirms)
- [ ] Register Transaction webhooks in Saleor
- [ ] Wire up checkout flow with Transaction API
- [ ] Implement commission calculation + VendorPayout records

### Week 7 — Storefronts
- [ ] Add `/vendors` route to `saleor-storefront`
- [ ] Build `VendorCard` component (logo, name, product count)
- [ ] Build Vendor Shop page with their channel's products
- [ ] Add vendor attribution to product detail page
- [ ] Add vendor filter to search
- [ ] Implement Next.js middleware for subdomain routing
- [ ] Build vendor-themed layout (CSS variables from vendor metadata)
- [ ] Test full checkout flow in vendor's channel (with shipping + payment)

### Week 8 — Order Routing + QA
- [ ] Implement `ORDER_CREATED` webhook handler
- [ ] Group order lines by vendor, store VendorOrder
- [ ] Notify vendor on new order (email)
- [ ] Notify shipping provider when order placed
- [ ] Test multi-vendor cart: customer buys from 2 vendors in one checkout
- [ ] Test order fulfillment flow (vendor marks as shipped)
- [ ] End-to-end integration test: register vendor → list product → customer buys → order routed → shipped
- [ ] Security review: verify channel scoping prevents cross-vendor data leaks

---

## Quick Reference: Key Saleor APIs Used

```graphql
# Create vendor channel
mutation ChannelCreate($input: ChannelCreateInput!) {
  channelCreate(input: $input) { channel { id slug } errors { ... } }
}

# Create vendor warehouse
mutation WarehouseCreate($input: WarehouseCreateInput!) {
  createWarehouse(input: $input) { warehouse { id } errors { ... } }
}

# Create permission group (scoped to channel)
mutation PermissionGroupCreate($input: PermissionGroupCreateInput!) {
  permissionGroupCreate(input: $input) { group { id } errors { ... } }
}

# Tag vendor metadata on any Saleor object
mutation UpdatePrivateMetadata($id: ID!, $input: [MetadataInput!]!) {
  updatePrivateMetadata(id: $id, input: $input) { item { ... } errors { ... } }
}

# Get vendor's products (by channel)
query VendorProducts($channel: String!, $first: Int!) {
  products(first: $first, channel: $channel, filter: { isPublished: true }) {
    edges { node { id name slug thumbnail { url } pricing { ... } } }
    pageInfo { hasNextPage endCursor }
  }
}
```

---

*Version 2.0 · June 2025 · Saleor 3.23 · Based on full re-evaluation of Dashboard reuse, payment agnosticism, and external shipping service platform architecture*
