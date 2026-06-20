import {
  QuoteRequestsLandingPage,
  QuoteRequestsRoute
} from "./_components/quote-request-sections";

export default function QuoteRequestsPage() {
  return (
    <QuoteRequestsRoute>
      <QuoteRequestsLandingPage />
    </QuoteRequestsRoute>
  );
}
