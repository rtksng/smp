type CheckoutSubmissionState = {
  cartHasItems: boolean;
  hasBlockingStockIssue: boolean;
  selectedAddressId: string | null | undefined;
};

export function getCheckoutSubmissionError({
  cartHasItems,
  hasBlockingStockIssue,
  selectedAddressId
}: CheckoutSubmissionState) {
  if (!cartHasItems) {
    return "Your cart is empty.";
  }

  if (!selectedAddressId) {
    return "Select a delivery address.";
  }

  if (hasBlockingStockIssue) {
    return "Resolve stock warnings before placing the order.";
  }

  return null;
}
