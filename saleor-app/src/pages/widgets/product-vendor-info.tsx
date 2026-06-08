import { Box, Text } from "@saleor/macaw-ui";

export default function ProductVendorInfoWidget() {
  return (
    <Box padding={4}>
      <Text fontWeight="bold">Marketplace vendor</Text>
      <Text color="default2">
        Product ownership is stored in marketplace metadata. Assign products through the marketplace control layer.
      </Text>
    </Box>
  );
}
