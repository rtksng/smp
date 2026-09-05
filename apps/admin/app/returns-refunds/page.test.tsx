import { describe, expect, it, vi } from "vitest";
import ReturnsRefundsPage from "./page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

describe("Returns and refunds entry route", () => {
  it("lands directly on the return request queue", () => {
    ReturnsRefundsPage();

    expect(redirect).toHaveBeenCalledWith("/returns-refunds/requests");
  });
});
