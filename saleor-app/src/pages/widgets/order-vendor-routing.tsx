import { Box, Text } from "@saleor/macaw-ui";

export default function OrderVendorRoutingWidget() {
  return (
    <Box padding={4}>
      <Text fontWeight="bold">Vendor routing</Text>
      <Text color="default2">
        Marketplace order webhooks record vendor line routing and COD/WhatsApp intent metadata.
      </Text>
    </Box>
  );
}
