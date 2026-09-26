"use client";

import { FormEvent, useEffect, useState } from "react";
import { Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminSession } from "../../lib/admin-session";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="stateScreen">Loading login...</main>}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, login, session } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = normalizeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(nextPath);
    }
  }, [isLoading, nextPath, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.replace(nextPath);
    } catch (loginError: unknown) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in with those credentials."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="loginScreen">
      <section className="loginPanel" aria-labelledby="login-heading">
        <div className="loginLogo">
          <Image
            alt="Hospi Surgical Division"
            height={200}
            priority
            sizes="(max-width: 520px) 220px, 280px"
            src="/brand/hospisurgical.png"
            width={500}
          />
        </div>

        <div className="loginHeading">
          <p className="eyebrow">Admin access</p>
          <h1 id="login-heading">Sign in to operations</h1>
          <p>Enter your administrator credentials to continue.</p>
        </div>

        <form className="formStack loginForm" onSubmit={handleSubmit}>
          <label>
            Email
            <Input
              autoComplete="email"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <Input
              autoComplete="current-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="loginSubmit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}

function normalizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
