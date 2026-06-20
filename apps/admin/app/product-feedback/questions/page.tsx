import {
  ProductFeedbackRoute,
  ProductQuestionsPage
} from "../_components/product-feedback-sections";

export default function QuestionsPage() {
  return (
    <ProductFeedbackRoute>
      <ProductQuestionsPage />
    </ProductFeedbackRoute>
  );
}
