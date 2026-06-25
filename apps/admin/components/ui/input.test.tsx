import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";

function SlugFieldProbe() {
  const form = useForm<{ slug: string }>({
    defaultValues: {
      slug: ""
    }
  });

  return createElement(
    "form",
    null,
    createElement(
      "label",
      null,
      "Slug",
      createElement(Input, { ...form.register("slug") })
    ),
    createElement(
      "button",
      {
        onClick: () =>
          form.setValue("slug", "curved-artery-forceps", {
            shouldDirty: true,
            shouldValidate: true
          }),
        type: "button"
      },
      "Generate"
    )
  );
}

function SubmitProbe({
  onSubmit
}: {
  onSubmit: (values: { slug: string }) => void;
}) {
  const form = useForm<{ slug: string }>({
    defaultValues: {
      slug: ""
    }
  });

  return createElement(
    "form",
    { onSubmit: form.handleSubmit(onSubmit) },
    createElement(
      "label",
      null,
      "Slug",
      createElement(Input, { ...form.register("slug") })
    ),
    createElement("button", { type: "submit" }, "Save")
  );
}

describe("Input", () => {
  it("reflects react-hook-form setValue updates in the visible input", () => {
    render(createElement(SlugFieldProbe));

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.getByLabelText("Slug")).toHaveValue("curved-artery-forceps");
  });

  it("submits manually typed react-hook-form values", async () => {
    const onSubmit = vi.fn();
    render(createElement(SubmitProbe, { onSubmit }));

    fireEvent.change(screen.getByLabelText("Slug"), {
      target: {
        value: "manual-product-slug"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          slug: "manual-product-slug"
        },
        expect.anything()
      );
    });
  });
});
