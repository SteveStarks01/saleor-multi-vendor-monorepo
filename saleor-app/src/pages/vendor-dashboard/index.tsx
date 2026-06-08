import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { FormEvent, useEffect, useState } from "react";

import { MarketplaceShell } from "@/components/MarketplaceShell";

type Vendor = {
  slug: string;
  shopName: string;
  description?: string | null;
  whatsappNumber?: string | null;
  codEnabled: boolean;
  whatsappCheckoutEnabled: boolean;
};

export default function VendorDashboardPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedVendor = vendors.find((vendor) => vendor.slug === selectedSlug) ?? vendors[0];
  const [message, setMessage] = useState<string | null>(null);

  const loadVendors = async () => {
    const response = await fetch("/api/marketplace/vendors?active=true");
    const data = await response.json();
    setVendors(data.vendors ?? []);
    setSelectedSlug((current) => current || data.vendors?.[0]?.slug || "");
  };

  useEffect(() => {
    void loadVendors();
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedVendor) return;

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/marketplace/vendors/${selectedVendor.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: form.get("shopName"),
        description: form.get("description"),
        whatsappNumber: form.get("whatsappNumber"),
        codEnabled: form.get("codEnabled") === "on",
        whatsappCheckoutEnabled: form.get("whatsappCheckoutEnabled") === "on",
      }),
    });

    setMessage(response.ok ? "Vendor profile saved." : "Unable to save vendor profile.");
    await loadVendors();
  };

  return (
    <MarketplaceShell title="My Vendor Shop" subtitle="Manage shop identity and customer checkout options.">
      {vendors.length > 1 && (
        <Box display="flex" gap={3} alignItems="center">
          <Text>Vendor</Text>
          <select value={selectedVendor?.slug ?? ""} onChange={(event) => setSelectedSlug(event.target.value)}>
            {vendors.map((vendor) => (
              <option key={vendor.slug} value={vendor.slug}>
                {vendor.shopName}
              </option>
            ))}
          </select>
        </Box>
      )}

      {selectedVendor ? (
        <Box as="form" display="grid" gap={4} onSubmit={saveProfile}>
          <Input name="shopName" label="Shop name" defaultValue={selectedVendor.shopName} required />
          <Input name="description" label="Description" defaultValue={selectedVendor.description ?? ""} />
          <Input name="whatsappNumber" label="WhatsApp number" defaultValue={selectedVendor.whatsappNumber ?? ""} />
          <label>
            <input name="codEnabled" type="checkbox" defaultChecked={selectedVendor.codEnabled} /> Cash on delivery
          </label>
          <label>
            <input
              name="whatsappCheckoutEnabled"
              type="checkbox"
              defaultChecked={selectedVendor.whatsappCheckoutEnabled}
            />{" "}
            WhatsApp checkout
          </label>
          {message && <Text color={message.includes("Unable") ? "critical1" : "success1"}>{message}</Text>}
          <Box>
            <Button type="submit">Save profile</Button>
          </Box>
        </Box>
      ) : (
        <Text color="default2">No active vendor profile found.</Text>
      )}
    </MarketplaceShell>
  );
}
