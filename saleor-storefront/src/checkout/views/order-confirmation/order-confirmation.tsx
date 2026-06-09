import { useEffect, useState } from "react";
import { CheckCircle2, Package, Truck, MessageSquare } from "lucide-react";

import { useOrderQuery } from "@/checkout/graphql";
import { formatMoney } from "@/checkout/lib/utils/money";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { Button } from "@/ui/components/ui/button";

export const OrderConfirmationView = ({ orderId, method }: { orderId: string, method?: string }) => {
	const [result] = useOrderQuery({
		variables: { id: orderId },
		pause: !orderId,
	});

	const [waUrl, setWaUrl] = useState<string | null>(null);

	const order = result.data?.order;
	const fetching = result.fetching;

	useEffect(() => {
		if (method === "whatsapp" && order) {
			const buildWaMessage = async () => {
				try {
					const vendorPhone = "1234567890";
					const text = encodeURIComponent(`Hello, I would like to confirm my order #${order.number}.\nTotal: ${formatMoney(order.total.gross.amount, order.total.gross.currency)}\nPlease let me know the next steps.`);
					setWaUrl(`https://wa.me/${vendorPhone}?text=${text}`);
				} catch (err) {
					console.error("Failed to build WhatsApp message", err);
				}
			};
			buildWaMessage();
		}
	}, [method, order]);

	if (fetching) {
		return <OrderConfirmationSkeleton />;
	}

	if (!order) {
		return (
			<div className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
				<p className="text-muted-foreground">Order not found.</p>
				<Button onClick={() => (window.location.href = "/")}>Return to Store</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-8 py-12 md:py-24">
			<div className="text-center">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
					<CheckCircle2 className="h-8 w-8" />
				</div>
				<h1 className="mt-6 text-3xl font-bold tracking-tight">Order confirmed</h1>
				<p className="mt-2 text-muted-foreground">
					Order #{order.number}
				</p>
			</div>

			{method === "whatsapp" && waUrl && (
				<div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
					<MessageSquare className="mx-auto h-8 w-8 text-green-600" />
					<h2 className="mt-4 text-xl font-semibold text-green-900">Complete your order via WhatsApp</h2>
					<p className="mt-2 text-green-800">
						Please click the button below to send your order details to the vendor. Your order is pending confirmation.
					</p>
					<Button className="mt-6 bg-green-600 hover:bg-green-700 text-white" asChild>
						<a href={waUrl} target="_blank" rel="noopener noreferrer">
							Send WhatsApp Message
						</a>
					</Button>
				</div>
			)}

			<div className="rounded-xl border bg-card">
				<div className="border-b p-6">
					<h2 className="font-semibold">Order Summary</h2>
				</div>
				<div className="p-6">
					<ul className="space-y-4">
						{order.lines.map((line) => (
							<li key={line.id} className="flex items-center justify-between">
								<div className="flex items-center space-x-4">
									{line.thumbnail?.url && (
										<img
											src={line.thumbnail.url}
											alt={line.productName}
											className="h-16 w-16 rounded-md object-cover"
										/>
									)}
									<div>
										<p className="font-medium">{line.productName}</p>
										<p className="text-sm text-muted-foreground">Qty: {line.quantity}</p>
									</div>
								</div>
								<p className="font-medium">
									{formatMoney(line.totalPrice.gross.amount, line.totalPrice.gross.currency)}
								</p>
							</li>
						))}
					</ul>
				</div>
				<div className="border-t bg-muted/50 p-6">
					<div className="flex items-center justify-between font-bold">
						<span>Total</span>
						<span>{formatMoney(order.total.gross.amount, order.total.gross.currency)}</span>
					</div>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<div className="rounded-xl border bg-card p-6">
					<div className="mb-4 flex items-center gap-2 font-semibold">
						<Package className="h-5 w-5" />
						Shipping Address
					</div>
					{order.shippingAddress ? (
						<address className="not-italic text-muted-foreground">
							{order.shippingAddress.firstName} {order.shippingAddress.lastName}
							<br />
							{order.shippingAddress.streetAddress1}
							{order.shippingAddress.streetAddress2 && (
								<>
									<br />
									{order.shippingAddress.streetAddress2}
								</>
							)}
							<br />
							{order.shippingAddress.city}, {order.shippingAddress.postalCode}
							<br />
							{order.shippingAddress.country.country}
						</address>
					) : (
						<p className="text-muted-foreground">No shipping address provided.</p>
					)}
				</div>
				<div className="rounded-xl border bg-card p-6">
					<div className="mb-4 flex items-center gap-2 font-semibold">
						<Truck className="h-5 w-5" />
						Shipping Method
					</div>
					<p className="text-muted-foreground">
						{order.shippingMethodName || "Standard Shipping"}
					</p>
				</div>
			</div>

			<div className="text-center">
				<Button onClick={() => (window.location.href = "/")} variant="outline">
					Continue Shopping
				</Button>
			</div>
		</div>
	);
};

const OrderConfirmationSkeleton = () => {
	return (
		<div className="mx-auto max-w-2xl space-y-8 py-12 md:py-24">
			<div className="flex flex-col items-center text-center">
				<Skeleton className="h-16 w-16 rounded-full" />
				<Skeleton className="mt-6 h-8 w-48" />
				<Skeleton className="mt-2 h-4 w-32" />
			</div>

			<div className="rounded-xl border bg-card">
				<div className="border-b p-6">
					<Skeleton className="h-6 w-32" />
				</div>
				<div className="p-6 space-y-4">
					{[1, 2].map((i) => (
						<div key={i} className="flex items-center justify-between">
							<div className="flex items-center space-x-4">
								<Skeleton className="h-16 w-16 rounded-md" />
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-16" />
								</div>
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
