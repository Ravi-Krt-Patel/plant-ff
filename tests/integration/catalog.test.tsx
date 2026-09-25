import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { products } from "@/mocks/catalog";
import { useCatalog } from "@/features/catalog/use-catalog";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  path: "/shop",
  search: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.path,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
afterEach(() => {
  cleanup();
  navigation.push.mockClear();
  navigation.path = "/shop";
  navigation.search = "";
});

describe("catalog routing adapter", () => {
  it("updates the URL and reads selections back from navigation", () => {
    navigation.search = "page=3";
    const { result, rerender } = renderHook(() => useCatalog(products));
    act(() => result.current.update("care", "easy"));
    expect(navigation.push).toHaveBeenCalledWith("/shop?care=easy", {
      scroll: false,
    });
    navigation.search = "care=easy";
    rerender();
    expect(result.current.query.care).toBe("easy");
    expect(result.current.page).toBe(1);
    expect(result.current.items.every((p) => p.care === "Easy care")).toBe(
      true,
    );
    navigation.search = "page=3";
    rerender();
    expect(result.current.query.care).toBe("");
    expect(result.current.page).toBe(3);
  });
  it("preserves search filters in pagination links", () => {
    navigation.path = "/search";
    navigation.search = "q=plant&sort=price-low";
    const { result } = renderHook(() => useCatalog(products));
    expect(result.current.pageHref(2)).toBe(
      "/search?q=plant&sort=price-low&page=2",
    );
  });
  it("clears query parameters while retaining the collection route", () => {
    navigation.path = "/collections/indoor-plants";
    navigation.search = "category=other&care=easy";
    const { result } = renderHook(() => useCatalog(products, "indoor-plants"));
    expect(result.current.query.category).toBe("indoor-plants");
    act(() => result.current.clear());
    expect(navigation.push).toHaveBeenCalledWith("/collections/indoor-plants");
  });
});
