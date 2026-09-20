export const orderIds = [
  "KG-SAMPLE-001",
  ...Array.from(
    { length: 20 },
    (_, i) => `KG-DEMO-${String(i + 1).padStart(3, "0")}`,
  ),
];
