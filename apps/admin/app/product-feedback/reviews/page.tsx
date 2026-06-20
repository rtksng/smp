import {
  ProductFeedbackRoute,
  ProductReviewsPage
} from "../_components/product-feedback-sections";

export default function ReviewsPage() {
  return (
    <ProductFeedbackRoute>
      <ProductReviewsPage />
    </ProductFeedbackRoute>
  );
}
