// lib/server/readPublicJson.ts
import "server-only";

type ReadPublicJsonOptions = {
  revalidateSeconds?: number;
  noStore?: boolean;
};

function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}

function getBlobBase() {
  const base =
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    "";
  return normalizeBase(base);
}

function normalizeBlobKey(input: string) {
  const s = normalizePath(input);
  if (!s) return s;

  // Convert "public/data/..." -> "data/..."
  if (s.startsWith("public/data/")) return s.replace(/^public\/data\//, "data/");

  // Keep "data/..." as-is
  if (s.startsWith("data/")) return s;

  // Force everything else under "data/"
  return `data/${s}`;
}

export async function readPublicJson<T>(
  pathnameInput: string,
  opts: ReadPublicJsonOptions = {}
): Promise<T> {
  const keyRaw = normalizePath(pathnameInput);
  if (!keyRaw) throw new Error("readPublicJson: missing pathname");

  const key = normalizeBlobKey(keyRaw);
  const base = getBlobBase();

  if (!base) {
    throw new Error(
      `readPublicJson: Missing BLOB_BASE_URL / NEXT_PUBLIC_BLOB_BASE_URL (requested key="${key}")`
    );
  }

  const url = `${base}/${key}`;

  const revalidateSeconds =
    typeof opts.revalidateSeconds === "number" ? opts.revalidateSeconds : 900;

  const res = await fetch(url, {
    ...(opts.noStore ? { cache: "no-store" as const } : {}),
    next: opts.noStore ? undefined : { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `readPublicJson: Blob fetch failed (${res.status}) url=${url} key="${key}"` +
        (text ? `\nBody: ${text.slice(0, 500)}` : "")
    );
  }

  return (await res.json()) as T;
}
