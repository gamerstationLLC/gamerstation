// lib/blob-client.ts
export function blobUrl(p: string) {
  const base =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    "https://or3vgdqybw6oou7j.public.blob.vercel-storage.com";

  const path = String(p || "").replace(/^\/+/, "");
  return `${base}/${path}`;
}
