import fs from "node:fs";
import path from "node:path";
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const chunks = walk("out/_next/static").filter((f) => f.endsWith(".js"));
const total = chunks.reduce((n, p) => n + fs.statSync(p).size, 0);
console.log(
  JSON.stringify(
    {
      javascriptChunks: chunks.length,
      totalJavaScriptBytes: total,
      scope: "All routes, uncompressed; not initial-route transfer",
    },
    null,
    2,
  ),
);
if (total > 2500000)
  throw new Error("Total JavaScript exceeds 2.5 MB demo baseline budget");
for (const page of [
  "out/index.html",
  "out/products/monstera-deliciosa/index.html",
]) {
  const html = fs.readFileSync(page, "utf8");
  if (!html.includes("Monstera Deliciosa") || !html.includes("noindex"))
    throw new Error("Missing public product HTML or noindex");
}
console.log("Server-rendered product text and noindex verified.");
