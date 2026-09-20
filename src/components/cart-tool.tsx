"use client";
import { useEffect } from "react";
import { useStore } from "@/features/cart/store";
type Registry = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function CartTool() {
  const { lines } = useStore();
  useEffect(() => {
    const context = (document as Document & { modelContext?: Registry })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_demo_shopping_bag",
            description:
              "Read the current demo shopping bag. This does not place an order or change the bag.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input) => {
              if (
                typeof input !== "object" ||
                input === null ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object");
              return { demo: true, lines: lines.map((line) => ({ ...line })) };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [lines]);
  return null;
}
