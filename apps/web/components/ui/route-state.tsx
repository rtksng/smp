import { Container } from "./container";
import { ErrorState, RetryButton } from "./error-state";
import { PageLoader } from "./loading-spinner";

type RouteErrorStateProps = {
  message?: string;
  onReset?: () => void;
  title?: string;
};

type RouteLoadingStateProps = {
  label?: string;
};

export function RouteLoadingState({ label = "Loading page" }: RouteLoadingStateProps) {
  return (
    <main className="bg-[#f5f8f7]">
      <Container className="py-8">
        <PageLoader label={label} />
      </Container>
    </main>
  );
}

export function RouteErrorState({
  message = "Refresh the page or try again in a moment.",
  onReset,
  title = "Unable to load this page"
}: RouteErrorStateProps) {
  return (
    <main className="bg-[#f5f8f7]">
      <Container className="grid min-h-[60vh] place-items-center py-8">
        <ErrorState
          action={onReset ? <RetryButton onRetry={onReset} /> : null}
          className="w-full max-w-xl bg-white shadow-sm"
          message={message}
          title={title}
        />
      </Container>
    </main>
  );
}
