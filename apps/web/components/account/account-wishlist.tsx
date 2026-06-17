"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartOff } from "lucide-react";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import { customerQueryKeys } from "../../lib/api/query-keys";
import {
  getWishlist,
  removeWishlistItem
} from "../../lib/api/wishlist";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { ProductCard } from "../ui/product-card";
import { Skeleton } from "../ui/skeleton";
import {
  AccountSection,
  AccountSectionHeader,
  CustomerAccountShell,
  PrivateEmptyState
} from "./customer-account-shell";

export function AccountWishlist() {
  const queryClient = useQueryClient();
  const wishlistQuery = useQuery({
    queryFn: getWishlist,
    queryKey: customerQueryKeys.wishlist()
  });
  const removeMutation = useMutation({
    mutationFn: removeWishlistItem,
    onSuccess: (wishlist) => {
      queryClient.setQueryData(customerQueryKeys.wishlist(), wishlist);
    }
  });
  const products = wishlistQuery.data?.items ?? [];

  return (
    <CustomerAccountShell
      activePath="/account/wishlist"
      description="Review saved products and move back into the catalog when ready."
      title="Wishlist"
    >
      {wishlistQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-80" key={index} />
          ))}
        </div>
      ) : null}

      {wishlistQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => wishlistQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(
            wishlistQuery.error,
            "Unable to load wishlist."
          )}
          title="Unable to load wishlist"
        />
      ) : null}

      {wishlistQuery.isSuccess && products.length === 0 ? (
        <PrivateEmptyState
          action={<Button href="/products">Browse products</Button>}
          description="Saved products will appear here for repeat review."
          title="No saved products"
        />
      ) : null}

      {products.length > 0 ? (
        <AccountSection>
          <AccountSectionHeader
            description={`${products.length} saved product${products.length === 1 ? "" : "s"}.`}
            title="Saved products"
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <div className="grid gap-3" key={product.id}>
                <ProductCard product={product} />
                <Button
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(product.id)}
                  variant="outline"
                >
                  <HeartOff aria-hidden="true" className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </AccountSection>
      ) : null}
    </CustomerAccountShell>
  );
}
