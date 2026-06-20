import { CustomersLandingPage, CustomersRoute } from "./_components/customer-sections";

export default function CustomersPage() {
  return (
    <CustomersRoute>
      <CustomersLandingPage />
    </CustomersRoute>
  );
}
