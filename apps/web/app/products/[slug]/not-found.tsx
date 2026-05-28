import { NotFoundPage } from "../../../components/ui/not-found-page";

export default function ProductNotFound() {
  return (
    <NotFoundPage
      message="We could not find that product. It may have been removed or unpublished."
      title="Product not found"
    />
  );
}
