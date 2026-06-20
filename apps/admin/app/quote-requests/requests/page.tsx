import {
  QuoteRequestQueuePage,
  QuoteRequestsRoute
} from "../_components/quote-request-sections";

export default function QuoteRequestQueueRoutePage() {
  return (
    <QuoteRequestsRoute>
      <QuoteRequestQueuePage />
    </QuoteRequestsRoute>
  );
}
