import { NotFoundPage } from "../../../components/ui/not-found-page";

export default function CategoryNotFound() {
  return (
    <NotFoundPage
      message="We could not find that product category. Browse all products or choose another category."
      title="Category not found"
    />
  );
}
