// Enforce the shipped asset budget, not the Storybook/tooling dependency size.
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const root = new URL("../frontend/dist/", import.meta.url);
let total = 0;
async function walk(url) {
  for (const entry of await readdir(url, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(js|css)$/.test(entry.name)) {
      const data = await readFile(file);
      total += gzipSync(data).length;
      if (
        /UI fixture|__uiCalls|Пользовательский список|storybook/i.test(
          data.toString(),
        )
      )
        throw new Error("Test fixtures or Storybook leaked into production");
    }
  }
}
await walk(root);
console.log(
  `Production JavaScript + CSS: ${(total / 1024).toFixed(1)} KiB gzip (limit 100 KiB)`,
);
if (total > 100 * 1024)
  throw new Error("Frontend exceeds the 100 KiB gzip budget");
