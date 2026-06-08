"use client";
import { useSearchParams } from "next/navigation";
import { EmptyCartPage } from "./empty-cart-page/empty-cart-page";
import { OrderConfirmationView } from "./order-confirmation/order-confirmation";
import { SaleorCheckoutView } from "./saleor-checkout";
import { PageNotFound } from "./page-not-found";
import { useCheckoutIdFromUrl } from "@/checkout/hooks/use-checkout-id-from-url";
import { useCheckoutQuery } from "@/checkout/graphql";
import { Loader } from "@/ui/atoms/loader";

export const RootViews = () => {
	const checkoutId = useCheckoutIdFromUrl();
	const searchParams = useSearchParams();
	const orderId = searchParams.get("orderId");
	const method = searchParams.get("method") || undefined;

	const [result] = useCheckoutQuery({
		variables: { id: checkoutId! },
		pause: !checkoutId || !!orderId,
	});

	if (orderId) {
		return <OrderConfirmationView orderId={orderId} method={method} />;
	}

	if (!checkoutId) {
		return <PageNotFound />;
	}

	if (result.fetching) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader />
			</div>
		);
	}

	if (!result.data?.checkout) {
		return <PageNotFound />;
	}

	const { checkout } = result.data;
	const isCartEmpty = checkout.lines.length === 0;

	if (isCartEmpty) {
		return <EmptyCartPage />;
	}

	return <SaleorCheckoutView checkout={checkout} />;
};
