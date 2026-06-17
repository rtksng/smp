"use client";

import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import {
  createQuoteRequest,
  quoteRequestInputSchema,
  type QuoteRequestInput
} from "../../lib/api/quote-requests";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const emptyForm: QuoteRequestInput = {
  email: "",
  message: "",
  mobileNumber: "",
  name: "",
  organization: null
};

type FieldErrors = Partial<Record<keyof QuoteRequestInput, string>>;

export function BulkQuoteForm() {
  const [form, setForm] = useState<QuoteRequestInput>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const quoteMutation = useMutation({
    mutationFn: createQuoteRequest,
    onSuccess: (request) => {
      setForm(emptyForm);
      setErrors({});
      setSuccessMessage(`Quote request ${request.id} received.`);
    }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = quoteRequestInputSchema.safeParse({
      ...form,
      organization: form.organization?.trim() || null
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;

      setErrors({
        email: flattened.email?.[0],
        message: flattened.message?.[0],
        mobileNumber: flattened.mobileNumber?.[0],
        name: flattened.name?.[0],
        organization: flattened.organization?.[0]
      });
      return;
    }

    try {
      setSuccessMessage(null);
      setErrors({});
      await quoteMutation.mutateAsync(parsed.data);
    } catch {
      setSuccessMessage(null);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Name"
          error={errors.name}
          id="bulk-quote-name"
          onChange={(event) => updateForm("name", event.target.value)}
          placeholder="Name"
          value={form.name}
        />
        <Input
          aria-label="Organization"
          error={errors.organization}
          id="bulk-quote-organization"
          onChange={(event) => updateForm("organization", event.target.value)}
          placeholder="Clinic or hospital"
          value={form.organization ?? ""}
        />
        <Input
          aria-label="Email"
          error={errors.email}
          id="bulk-quote-email"
          onChange={(event) => updateForm("email", event.target.value)}
          placeholder="Email"
          type="email"
          value={form.email}
        />
        <Input
          aria-label="Mobile number"
          error={errors.mobileNumber}
          id="bulk-quote-mobile"
          onChange={(event) => updateForm("mobileNumber", event.target.value)}
          placeholder="Mobile number"
          value={form.mobileNumber}
        />
      </div>
      <textarea
        aria-label="Bulk quote details"
        className="min-h-28 rounded-lg border border-white/25 bg-white px-4 py-3 text-sm font-semibold text-[#12314f] outline-none transition placeholder:text-[#52677f] focus:border-white focus:ring-2 focus:ring-white/30"
        onChange={(event) => updateForm("message", event.target.value)}
        placeholder="SKUs, quantities, city, and delivery timeline"
        value={form.message}
      />
      {errors.message ? (
        <p className="text-sm font-bold text-white">{errors.message}</p>
      ) : null}
      {quoteMutation.isError ? (
        <p className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-[#7a271a]">
          {getFriendlyApiErrorMessage(
            quoteMutation.error,
            "Unable to submit quote request."
          )}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-[#006d77]">
          {successMessage}
        </p>
      ) : null}
      <Button
        className="w-full bg-white !text-[#0b4f9f] hover:bg-[#edf6ff] sm:w-fit"
        disabled={quoteMutation.isPending}
        type="submit"
        variant="outline"
      >
        {quoteMutation.isPending ? "Submitting..." : "Request bulk quote"}
      </Button>
    </form>
  );

  function updateForm<Field extends keyof QuoteRequestInput>(
    field: Field,
    value: QuoteRequestInput[Field]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    setErrors((current) => ({
      ...current,
      [field]: undefined
    }));
  }
}
