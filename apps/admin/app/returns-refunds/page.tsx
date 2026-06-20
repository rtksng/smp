import {
  ReturnsRefundsLandingPage,
  ReturnsRefundsRoute
} from "./_components/returns-refunds-sections";

export default function ReturnsRefundsPage() {
  return (
    <ReturnsRefundsRoute>
      <ReturnsRefundsLandingPage />
    </ReturnsRefundsRoute>
  );
}
