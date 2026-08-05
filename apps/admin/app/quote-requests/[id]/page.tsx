import {
  QuoteRequestDetailPage,
  QuoteRequestsRoute
} from "../_components/quote-request-sections";

export default function QuoteRequestDetailRoutePage() {
  return (
    <QuoteRequestsRoute>
      <QuoteRequestDetailPage />
    </QuoteRequestsRoute>
  );
}
