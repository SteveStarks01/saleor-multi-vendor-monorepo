import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { FormEvent, useEffect, useState } from "react";

import { MarketplaceShell } from "@/components/MarketplaceShell";

type Vendor = {
  id: string;
  slug: string;
  shopName: string;
  email: string;
  status: string;
  whatsappNumber?: string | null;
  codEnabled: boolean;
  whatsappCheckoutEnabled: boolean;
};

export default function VendorManagementPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadVendors = async () => {
    const response = await fetch("/api/marketplace/vendors");
    const data = await response.json();
    setVendors(data.vendors ?? []);
  };

  useEffect(() => {
    void loadVendors();
  }, []);

  const createVendor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/marketplace/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: form.get("shopName"),
        email: form.get("email"),
        whatsappNumber: form.get("whatsappNumber"),
        description: form.get("description"),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Unable to create vendor");
    } else {
      event.currentTarget.reset();
      await loadVendors();
    }

    setLoading(false);
  };

  return (
    <MarketplaceShell title="Vendor Management" subtitle="Create vendors and review marketplace access.">
      <Box as="form" display="grid" gap={4} onSubmit={createVendor}>
        <Input name="shopName" label="Shop name" required />
        <Input name="email" label="Vendor email" type="email" required />
        <Input name="whatsappNumber" label="WhatsApp number" />
        <Input name="description" label="Short description" />
        {error && <Text color="critical1">{error}</Text>}
        <Box>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create vendor"}
          </Button>
        </Box>
      </Box>

      <Box display="grid" gap={3}>
        {vendors.map((vendor) => (
          <Box key={vendor.id} padding={4} borderWidth={1} borderStyle="solid" borderColor="default1">
            <Text fontWeight="bold">{vendor.shopName}</Text>
            <Text color="default2">{vendor.email}</Text>
            <Text color="default2">
              {vendor.slug} · {vendor.status} · COD {vendor.codEnabled ? "on" : "off"} · WhatsApp{" "}
              {vendor.whatsappCheckoutEnabled ? "on" : "off"}
            </Text>
          </Box>
        ))}
      </Box>
    </MarketplaceShell>
  );
}
