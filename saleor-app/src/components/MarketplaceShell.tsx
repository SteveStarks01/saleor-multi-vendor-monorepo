import { Box, Text } from "@saleor/macaw-ui";
import { ReactNode } from "react";

export function MarketplaceShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Box padding={8} display="flex" flexDirection="column" gap={6}>
      <Box>
        <Text as="h1" size={10} fontWeight="bold">
          {title}
        </Text>
        {subtitle && (
          <Text as="p" color="default2" marginTop={2}>
            {subtitle}
          </Text>
        )}
      </Box>
      {children}
    </Box>
  );
}
