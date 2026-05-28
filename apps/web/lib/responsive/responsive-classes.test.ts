import { describe, expect, it } from "vitest";
import {
  mobileBottomSheetPanelClassName,
  mobileCardListClassName,
  mobileDrawerPanelClassName
} from "./responsive-classes";

describe("responsive class contracts", () => {
  it("defines a mobile drawer panel that is fixed, scrollable, and desktop-hidden", () => {
    expect(mobileDrawerPanelClassName).toContain("fixed");
    expect(mobileDrawerPanelClassName).toContain("inset-y-0");
    expect(mobileDrawerPanelClassName).toContain("overflow-y-auto");
    expect(mobileDrawerPanelClassName).toContain("lg:hidden");
  });

  it("defines a mobile bottom sheet panel with constrained viewport height", () => {
    expect(mobileBottomSheetPanelClassName).toContain("fixed");
    expect(mobileBottomSheetPanelClassName).toContain("bottom-0");
    expect(mobileBottomSheetPanelClassName).toContain("max-h-[85dvh]");
    expect(mobileBottomSheetPanelClassName).toContain("overflow-y-auto");
  });

  it("defines mobile card list styling for table replacements", () => {
    expect(mobileCardListClassName).toContain("grid");
    expect(mobileCardListClassName).toContain("md:hidden");
  });
});
