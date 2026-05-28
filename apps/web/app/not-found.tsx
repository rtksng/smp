import { NotFoundPage } from "../components/ui/not-found-page";

export default function NotFound() {
  return (
    <NotFoundPage
      message="The page you requested does not exist or is no longer available."
      title="Page not found"
    />
  );
}
