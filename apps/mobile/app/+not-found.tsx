import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/state-view";

export default function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState
        action={<Button href="/">Return home</Button>}
        description="The requested mobile screen does not exist."
        title="Page not found"
      />
    </Screen>
  );
}
