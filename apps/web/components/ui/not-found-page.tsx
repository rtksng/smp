import type { ReactNode } from "react";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "./button";
import { Container } from "./container";
import { ErrorState } from "./error-state";

type NotFoundPageProps = {
  action?: ReactNode;
  message: string;
  title: string;
};

export function NotFoundPage({ action, message, title }: NotFoundPageProps) {
  return (
    <>
      <Header />
      <main className="bg-[#f4f9ff]">
        <Container className="grid min-h-[60vh] place-items-center py-8">
          <ErrorState
            action={action ?? <Button href="/products">Browse products</Button>}
            className="w-full max-w-xl bg-white"
            message={message}
            title={title}
          />
        </Container>
      </main>
      <Footer />
    </>
  );
}
