// @vitest-environment jsdom
import { cloneElement, type PropsWithChildren, type ReactElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Text } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreFooter } from "./store-footer";
import { Screen } from "./ui/screen";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  openURL: vi.fn(async (_url: string) => undefined)
}));

vi.mock("expo-router", () => ({
  Link: ({ children, href }: PropsWithChildren<{ href: unknown }>) => {
    const child = children as ReactElement<Record<string, unknown>>;
    return cloneElement(child, {
      accessibilityRole: "link",
      onPress: () => mocks.push(href),
      // Expo's native Slot passes styles through Radix's object-spread merge.
      style: { ...(child.props.style as Record<string, unknown>) }
    });
  }
}));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
vi.mock("react-native", async () => ({
  ...(await vi.importActual("react-native")),
  Linking: { openURL: mocks.openURL }
}));
vi.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: ({ children }: PropsWithChildren) => <div>{children}</div>
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("customer mobile shared footer", () => {
  it("preserves 44 point targets when Expo Slot merges each navigation link's styles", () => {
    render(<StoreFooter />);
    for (const label of [
      "All products",
      "Categories",
      "Brands",
      "Bulk quote",
      "Orders",
      "Quotes",
      "Saved addresses",
      "Cart"
    ]) {
      const style = getComputedStyle(screen.getByRole("link", { name: label }));
      expect(style.minHeight).toBe("44px");
      expect(style.alignSelf).toBe("flex-start");
    }
  });

  it("maps every customer web shop and support link to a native route", () => {
    render(<StoreFooter />);
    const destinations = [
      ["All products", "/search"],
      ["Categories", { pathname: "/", params: { section: "categories" } }],
      ["Brands", "/brands"],
      ["Bulk quote", { pathname: "/", params: { section: "bulk" } }],
      ["Orders", "/orders"],
      ["Quotes", "/account/quotes"],
      ["Saved addresses", "/addresses"],
      ["Cart", "/cart"]
    ] as const;
    for (const [label, destination] of destinations) {
      fireEvent.click(screen.getByRole("link", { name: label }));
      expect(mocks.push).toHaveBeenLastCalledWith(destination);
    }
    expect(mocks.openURL).not.toHaveBeenCalled();
  });

  it("opens phone or email support only after the customer presses it", async () => {
    render(<StoreFooter />);
    expect(mocks.openURL).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "+91 90000 00000" }));
    await waitFor(() =>
      expect(mocks.openURL).toHaveBeenLastCalledWith("tel:+919000000000")
    );
    fireEvent.click(screen.getByRole("link", { name: "support@surgical.example" }));
    await waitFor(() =>
      expect(mocks.openURL).toHaveBeenLastCalledWith("mailto:support@surgical.example")
    );
  });

  it("keeps the contact details available when no contact app can open", async () => {
    mocks.openURL.mockRejectedValueOnce(new Error("No app can open this link"));
    render(<StoreFooter />);
    fireEvent.click(screen.getByRole("link", { name: "support@surgical.example" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("link", { name: "support@surgical.example" })).toBeTruthy();
  });

  it("repeats category and bulk scrolling while already on home", () => {
    const onSectionPress = vi.fn();
    render(<StoreFooter onSectionPress={onSectionPress} />);
    fireEvent.click(screen.getByRole("link", { name: "Categories" }));
    fireEvent.click(screen.getByRole("link", { name: "Categories" }));
    fireEvent.click(screen.getByRole("link", { name: "Bulk quote" }));
    expect(onSectionPress.mock.calls).toEqual([
      ["categories"],
      ["categories"],
      ["bulk"]
    ]);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("is included by the shared screen wrapper without changes to individual account pages", () => {
    render(
      <Screen>
        <Text>Account details</Text>
      </Screen>
    );
    expect(screen.getByText("Account details")).toBeTruthy();
    expect(screen.getByTestId("store-footer")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Procurement" })).toBeTruthy();
  });
});
