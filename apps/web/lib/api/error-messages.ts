import { ApiClientError } from "./client";

const genericMessage =
  "Something went wrong while loading this information. Please try again.";

export function getFriendlyApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    if (error.status >= 500 || error.status === 0) {
      return genericMessage;
    }

    return error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function isNotFoundApiError(error: unknown) {
  return error instanceof ApiClientError && error.status === 404;
}

export function stockErrorMessage(availableQuantity?: number | null) {
  if (typeof availableQuantity === "number" && availableQuantity > 0) {
    return `Product out of stock. Only ${availableQuantity} unit(s) are available right now.`;
  }

  return "Product out of stock. This item is not available right now.";
}
