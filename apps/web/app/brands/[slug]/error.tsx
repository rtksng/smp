"use client";

import { RouteErrorState } from "../../../components/ui/route-state";

export default function BrandError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      message={error.message}
      onReset={reset}
      title="Unable to load brand"
    />
  );
}
