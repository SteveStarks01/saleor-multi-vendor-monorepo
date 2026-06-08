import { Box, Text } from "@saleor/macaw-ui";
import { useEffect, useState } from "react";

import { MarketplaceShell } from "@/components/MarketplaceShell";

export default function MarketplaceAnalyticsPage() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/marketplace/vendors")
      .then((response) => response.json())
      .then((data) => setCount(data.vendors?.length ?? 0))
      .catch(() => setCount(0));
  }, []);

  return (
    <MarketplaceShell title="Marketplace" subtitle="Operational snapshot for the marketplace vertical.">
      <Box display="grid" gridTemplateColumns={1} gap={4}>
        <Box padding={5} borderWidth={1} borderStyle="solid" borderColor="default1">
          <Text color="default2">Vendors</Text>
          <Text size={10} fontWeight="bold">
            {count}
          </Text>
        </Box>
        <Text color="default2">
          Order routing, payment intent, COD, and WhatsApp activity are recorded by the marketplace app APIs.
        </Text>
      </Box>
    </MarketplaceShell>
  );
}
