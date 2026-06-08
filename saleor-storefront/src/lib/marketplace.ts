export const marketplaceKeys = {
	vendorId: "marketplace_vendor_id",
	vendorSlug: "marketplace_vendor_slug",
	vendorName: "marketplace_vendor_name",
	vendorWhatsapp: "marketplace_vendor_whatsapp",
};

export type MetadataItem = {
	key: string;
	value: string;
};

export type VendorIdentity = {
	id?: string;
	slug: string;
	name: string;
	whatsapp?: string;
};

export function getMetadataValue(metadata: readonly MetadataItem[] | null | undefined, key: string) {
	return metadata?.find((item) => item.key === key)?.value || null;
}

export function getVendorFromMetadata(metadata: readonly MetadataItem[] | null | undefined): VendorIdentity | null {
	const slug = getMetadataValue(metadata, marketplaceKeys.vendorSlug);
	if (!slug) return null;

	return {
		id: getMetadataValue(metadata, marketplaceKeys.vendorId) ?? undefined,
		slug,
		name: getMetadataValue(metadata, marketplaceKeys.vendorName) ?? slug,
		whatsapp: getMetadataValue(metadata, marketplaceKeys.vendorWhatsapp) ?? undefined,
	};
}

export function getMarketplaceAppUrl() {
	return process.env.NEXT_PUBLIC_MARKETPLACE_APP_URL?.replace(/\/$/, "") || null;
}

export function formatAddressForMessage(address?: {
	streetAddress1?: string | null;
	streetAddress2?: string | null;
	city?: string | null;
	postalCode?: string | null;
	country?: { country?: string | null } | null;
} | null) {
	if (!address) return null;
	return [
		address.streetAddress1,
		address.streetAddress2,
		address.city,
		address.postalCode,
		address.country?.country,
	]
		.filter(Boolean)
		.join(", ");
}
