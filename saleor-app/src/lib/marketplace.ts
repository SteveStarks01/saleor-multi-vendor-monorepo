import { prisma } from "./prisma";

export const VENDOR_METADATA_KEYS = {
  id: "marketplace_vendor_id",
  slug: "marketplace_vendor_slug",
  name: "marketplace_vendor_name",
  whatsapp: "marketplace_vendor_whatsapp",
};

export type VendorInput = {
  shopName: string;
  email: string;
  slug?: string;
  description?: string;
  phone?: string;
  whatsappNumber?: string;
  logoUrl?: string;
  codEnabled?: boolean;
  whatsappCheckoutEnabled?: boolean;
};

export type CheckoutLineSummary = {
  productName: string;
  variantName?: string | null;
  quantity: number;
  totalAmount: number;
  currency: string;
  vendorSlug?: string | null;
  vendorName?: string | null;
  vendorWhatsapp?: string | null;
};

export type CheckoutSummary = {
  checkoutId: string;
  email?: string | null;
  totalAmount: number;
  currency: string;
  lines: CheckoutLineSummary[];
  shippingAddress?: string | null;
};

export function slugifyVendorName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function normalizeHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[^\d+]/g, "");
}

export function assertVendorSlug(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    throw new Error("Vendor slug must be 3-64 lowercase letters, numbers, or hyphens.");
  }
}

export function assertHostname(hostname: string) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) {
    throw new Error("Vendor domain must be a valid hostname.");
  }
}

export async function listVendors({ activeOnly = false } = {}) {
  return prisma.vendor.findMany({
    where: activeOnly ? { status: "ACTIVE" } : undefined,
    include: { domains: true, shippingProviders: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVendorBySlug(slug: string) {
  return prisma.vendor.findUnique({
    where: { slug },
    include: { domains: true, shippingProviders: true },
  });
}

export async function getVendorByHostname(hostname: string) {
  const domain = await prisma.vendorDomain.findUnique({
    where: { hostname: normalizeHostname(hostname) },
    include: { vendor: { include: { domains: true, shippingProviders: true } } },
  });

  return domain?.isVerified ? domain.vendor : null;
}

export async function createVendor(input: VendorInput) {
  const slug = input.slug ? slugifyVendorName(input.slug) : slugifyVendorName(input.shopName);
  assertVendorSlug(slug);

  return prisma.vendor.create({
    data: {
      slug,
      shopName: input.shopName.trim(),
      email: input.email.trim().toLowerCase(),
      description: input.description?.trim() || null,
      phone: normalizePhone(input.phone),
      whatsappNumber: normalizePhone(input.whatsappNumber),
      logoUrl: input.logoUrl?.trim() || null,
      codEnabled: input.codEnabled ?? true,
      whatsappCheckoutEnabled: input.whatsappCheckoutEnabled ?? true,
      status: "ACTIVE",
    },
  });
}

export async function updateVendor(slug: string, input: Partial<VendorInput> & { status?: string }) {
  assertVendorSlug(slug);

  return prisma.vendor.update({
    where: { slug },
    data: {
      shopName: input.shopName?.trim(),
      email: input.email?.trim().toLowerCase(),
      description: input.description?.trim(),
      phone: input.phone === undefined ? undefined : normalizePhone(input.phone),
      whatsappNumber:
        input.whatsappNumber === undefined ? undefined : normalizePhone(input.whatsappNumber),
      logoUrl: input.logoUrl?.trim(),
      codEnabled: input.codEnabled,
      whatsappCheckoutEnabled: input.whatsappCheckoutEnabled,
      status: input.status as never,
    },
  });
}

export async function addVendorDomain(slug: string, hostnameInput: string) {
  const vendor = await getVendorBySlug(slug);
  if (!vendor) throw new Error("Vendor not found.");
  const hostname = normalizeHostname(hostnameInput);
  assertHostname(hostname);

  return prisma.vendorDomain.create({
    data: {
      hostname,
      vendorId: vendor.id,
      isVerified: hostname.endsWith(".localhost"),
    },
  });
}

export function getVendorIdentityFromLine(line: CheckoutLineSummary) {
  if (!line.vendorSlug) return null;
  return {
    slug: line.vendorSlug,
    name: line.vendorName || line.vendorSlug,
    whatsapp: normalizePhone(line.vendorWhatsapp),
  };
}

export function getSingleVendorCheckout(checkout: CheckoutSummary) {
  const vendors = new Map<string, NonNullable<ReturnType<typeof getVendorIdentityFromLine>>>();

  for (const line of checkout.lines) {
    const vendor = getVendorIdentityFromLine(line);
    if (vendor) vendors.set(vendor.slug, vendor);
  }

  if (vendors.size !== 1) return null;
  return Array.from(vendors.values())[0];
}

export function buildWhatsappCheckoutMessage(checkout: CheckoutSummary) {
  const vendor = getSingleVendorCheckout(checkout);
  if (!vendor) {
    throw new Error("WhatsApp checkout requires a cart from exactly one vendor.");
  }

  const lines = checkout.lines.map((line, index) => {
    const variant = line.variantName ? ` (${line.variantName})` : "";
    return `${index + 1}. ${line.productName}${variant} x${line.quantity} - ${formatAmount(
      line.totalAmount,
      line.currency
    )}`;
  });

  return [
    `Hello ${vendor.name}, I would like to place this order:`,
    "",
    ...lines,
    "",
    `Total: ${formatAmount(checkout.totalAmount, checkout.currency)}`,
    checkout.email ? `Customer email: ${checkout.email}` : null,
    checkout.shippingAddress ? `Ship to: ${checkout.shippingAddress}` : null,
    `Checkout ID: ${checkout.checkoutId}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsappUrl(phone: string, message: string) {
  const normalized = normalizePhone(phone)?.replace(/^\+/, "");
  if (!normalized) throw new Error("Vendor does not have a WhatsApp number.");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export async function recordMarketplacePaymentIntent(
  checkout: CheckoutSummary,
  kind: "COD" | "WHATSAPP" | "ONLINE",
  message?: string
) {
  const vendor = getSingleVendorCheckout(checkout);
  const dbVendor = vendor ? await getVendorBySlug(vendor.slug) : null;

  return prisma.marketplacePaymentIntent.create({
    data: {
      vendorId: dbVendor?.id,
      saleorCheckoutId: checkout.checkoutId,
      kind,
      amount: checkout.totalAmount,
      currency: checkout.currency,
      whatsappMessage: message,
      metadata: {
        lineCount: checkout.lines.length,
        vendorSlug: vendor?.slug,
      },
    },
  });
}

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(amount);
}
