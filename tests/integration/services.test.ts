import { it, expect } from "vitest";
import { catalogService, paymentService } from "../../src/mocks/services";
it("supports cancellation at service boundaries", async () => {
  const abort = new AbortController();
  const search = catalogService.search("monstera", abort.signal);
  abort.abort();
  await expect(search).rejects.toHaveProperty("name", "AbortError");
});
it("returns only matching search results", async () => {
  const result = await catalogService.search("monstera");
  expect(result.ok && result.data[0]?.name).toBe("Monstera Deliciosa");
});
it.each(["success", "pending", "failure", "dismissed"] as const)(
  "preserves the simulated %s payment outcome",
  async (status) => {
    expect(await paymentService.confirm("KG-DEMO-001", status)).toEqual({
      ok: true,
      data: status,
    });
  },
);
