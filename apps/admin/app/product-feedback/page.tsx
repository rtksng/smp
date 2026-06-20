import {
  ProductFeedbackLandingPage,
  ProductFeedbackRoute
} from "./_components/product-feedback-sections";

export default function ProductFeedbackPage() {
  return (
    <ProductFeedbackRoute>
      <ProductFeedbackLandingPage />
    </ProductFeedbackRoute>
  );
}
