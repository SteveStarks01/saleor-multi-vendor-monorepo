import { notFound } from "next/navigation";

import { ProductListPaginatedDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { getMarketplaceAppUrl, getVendorFromMetadata } from "@/lib/marketplace";
import { CategoryHero, transformToProductCard } from "@/ui/components/plp";
import { ProductsPageClient } from "../../products/products-client";

type VendorResponse = {
	vendor?: {
		slug: string;
		shopName: string;
		description?: string | null;
		logoUrl?: string | null;
	};
};

async function getVendor(vendorSlug: string) {
	const appUrl = getMarketplaceAppUrl();
	if (!appUrl) return null;

	const response = await fetch(`${appUrl}/api/marketplace/vendors/${vendorSlug}`, {
		next: { revalidate: 120 },
	});

	if (!response.ok) return null;
	const data = (await response.json()) as VendorResponse;
	return data.vendor ?? null;
}

export default async function VendorPage(props: {
	params: Promise<{ channel: string; vendorSlug: string }>;
}) {
	const params = await props.params;
	const vendor = await getVendor(params.vendorSlug);

	if (!vendor) notFound();

	const result = await executePublicGraphQL(ProductListPaginatedDocument, {
		variables: {
			first: 24,
			channel: params.channel,
		},
		revalidate: 300,
	});

	if (!result.ok || !result.data.products) notFound();

	const productCards = result.data.products.edges
		.map((edge) => edge.node)
		.filter((product) => getVendorFromMetadata(product.metadata)?.slug === vendor.slug)
		.map((product) => transformToProductCard(product, params.channel));

	return (
		<>
			<CategoryHero
				title={vendor.shopName}
				description={vendor.description || "Products from this marketplace vendor."}
				backgroundImage={vendor.logoUrl || undefined}
				breadcrumbs={[
					{ label: "Home", href: `/${params.channel}` },
					{ label: "Vendors", href: `/${params.channel}/vendors/${vendor.slug}` },
					{ label: vendor.shopName, href: `/${params.channel}/vendors/${vendor.slug}` },
				]}
			/>
			<ProductsPageClient
				products={productCards}
				pageInfo={result.data.products.pageInfo}
				totalCount={productCards.length}
				resolvedCategories={[]}
			/>
		</>
	);
}
