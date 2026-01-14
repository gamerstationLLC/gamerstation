import fs from "node:fs/promises";
import path from "node:path";

export async function readPublicJson<T>(relPathFromPublic: string): Promise<T> {
  // Example: "data/lol/items.json"
  const filePath = path.join(process.cwd(), "public", relPathFromPublic);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}
