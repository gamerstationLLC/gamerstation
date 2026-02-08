export function blobUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
  return base ? `${base}/${path}` : `/${path}`;
}
