import { Button } from "../../../../components/ui/button";
import { NotFoundPage } from "../../../../components/ui/not-found-page";

export default function OrderNotFound() {
  return (
    <NotFoundPage
      action={<Button href="/account/orders">Back to orders</Button>}
      message="We could not find this order in your account."
      title="Order not found"
    />
  );
}
