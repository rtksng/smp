"use client";

import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import { isValidIndianMobileNumber } from "../../lib/auth/mobile";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import {
  createRequestOtpMutation,
  createVerifyOtpMutation
} from "../../lib/api/mutation-helpers";
import {
  useCustomerAuthStore
} from "../../lib/stores/auth-store";
import type { CustomerSession } from "../../lib/api/customer-auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type LoginStep = "request" | "verify";

type CustomerLoginFormProps = {
  className?: string;
  headingId?: string;
  onSuccess?: (session: CustomerSession) => void;
};

export function CustomerLoginForm({
  className,
  headingId,
  onSuccess
}: CustomerLoginFormProps) {
  const pendingMobileNumber = useCustomerAuthStore(
    (state) => state.pendingMobileNumber
  );
  const requestOtp = useCustomerAuthStore((state) => state.requestOtp);
  const verifyOtp = useCustomerAuthStore((state) => state.verifyOtp);
  const [mobileNumber, setMobileNumber] = useState(pendingMobileNumber ?? "");
  const [sentMobileNumber, setSentMobileNumber] = useState<string | null>(
    pendingMobileNumber
  );
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<LoginStep>(
    pendingMobileNumber ? "verify" : "request"
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canRequestOtp = useMemo(
    () => isValidIndianMobileNumber(mobileNumber),
    [mobileNumber]
  );
  const canVerifyOtp = /^\d{6}$/.test(otp);
  const requestOtpMutation = useMutation(
    createRequestOtpMutation({
      requestOtp,
      onSuccess: (otpRequest) => {
        setSentMobileNumber(otpRequest.mobileNumber);
        setMobileNumber(otpRequest.mobileNumber);
        setCooldownSeconds(otpRequest.resendAfterSeconds);
        setOtp("");
        setStep("verify");
      }
    })
  );
  const verifyOtpMutation = useMutation(
    createVerifyOtpMutation({
      verifyOtp,
      onSuccess: (session) => onSuccess?.(session)
    })
  );
  const isSubmitting = requestOtpMutation.isPending || verifyOtpMutation.isPending;

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds]);

  async function handleRequestOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);

    if (!canRequestOtp) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    try {
      await requestOtpMutation.mutateAsync(mobileNumber);
    } catch (requestError) {
      setError(toErrorMessage(requestError, "Unable to send OTP right now."));
    }
  }

  async function handleResendOtp() {
    if (!sentMobileNumber || cooldownSeconds > 0) {
      return;
    }

    await handleRequestOtp();
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canVerifyOtp) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync(otp);
    } catch (verifyError) {
      setError(toErrorMessage(verifyError, "Unable to verify that OTP."));
    }
  }

  return (
    <section className={["grid gap-6", className].filter(Boolean).join(" ")}>
      <div className="grid gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase text-[#9b6a1e]">
            Secure customer login
          </p>
          <h1
            className="mt-2 text-2xl font-bold leading-tight text-[#17211f]"
            id={headingId}
          >
            Sign in with mobile OTP
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#687773]">
            We will send a one-time password to your Indian mobile number.
          </p>
        </div>
      </div>

      {step === "request" ? (
        <form className="grid gap-4" onSubmit={handleRequestOtp}>
          <Input
            autoComplete="tel"
            error={error ?? undefined}
            icon={<Smartphone aria-hidden="true" className="h-4 w-4" />}
            inputMode="tel"
            label="Mobile number"
            maxLength={18}
            name="mobileNumber"
            onChange={(event) => setMobileNumber(event.target.value)}
            placeholder="98765 43210"
            value={mobileNumber}
          />
          <Button disabled={isSubmitting || !canRequestOtp} type="submit">
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            )}
            {isSubmitting ? "Sending OTP..." : "Request OTP"}
          </Button>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={handleVerifyOtp}>
          <div className="rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] px-4 py-3 shadow-sm shadow-[#0b5cab]/5">
            <p className="text-xs font-bold uppercase text-[#687773]">
              OTP sent to
            </p>
            <p className="mt-1 text-sm font-bold text-[#17211f]">
              {sentMobileNumber}
            </p>
          </div>
          <Input
            autoComplete="one-time-code"
            error={error ?? undefined}
            inputMode="numeric"
            label="6-digit OTP"
            maxLength={6}
            name="otp"
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            value={otp}
          />
          <Button disabled={isSubmitting || !canVerifyOtp} type="submit">
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            )}
            {isSubmitting ? "Verifying..." : "Verify and continue"}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className="inline-flex items-center gap-2 text-sm font-bold text-[#006d77]"
              onClick={() => {
                setError(null);
                setOtp("");
                setStep("request");
              }}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Change number
            </button>
            <button
              className="inline-flex items-center gap-2 text-sm font-bold text-[#006d77] disabled:cursor-not-allowed disabled:text-[#8da19c]"
              disabled={cooldownSeconds > 0 || isSubmitting}
              onClick={handleResendOtp}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {cooldownSeconds > 0
                ? `Resend in ${cooldownSeconds}s`
                : "Resend OTP"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function toErrorMessage(error: unknown, fallback: string) {
  return getFriendlyApiErrorMessage(error, fallback);
}
