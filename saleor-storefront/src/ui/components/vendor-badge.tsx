import Link from "next/link";
import { Store } from "lucide-react";

import type { VendorIdentity } from "@/lib/marketplace";

export function VendorBadge({ vendor, channel }: { vendor: VendorIdentity | null; channel: string }) {
	if (!vendor) return null;

	return (
		<Link
			href={`/${channel}/vendors/${vendor.slug}`}
			className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
		>
			<Store className="h-3.5 w-3.5 shrink-0" />
			<span className="truncate">{vendor.name}</span>
		</Link>
	);
}
