// scripts/wow/probe-item-db.ts
//
// Lightweight "should rebuild?" probe.
// Fetches a few small WoW Game Data endpoints, hashes them,
// and compares against last saved probe hash in public/data/wow/items/probe.json.
//
// Env (server-only):
//   BNET_CLIENT_ID
//   BNET_CLIENT_SECRET
//
// Exit codes:
//   0 => no rebuild needed (probe unchanged)
//   10 => rebuild needed (probe changed or missing)

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function requireEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

async function getAccessTokenUS(clientId: string, clientSecret: string) {
  const tokenUrl = `https://us.battle.net/oauth/token`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token HTTP ${res.status}: ${text.slice(0, 800)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token returned");
  return json.access_token;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 800)}`);
  }
  return (await res.json()) as T;
}

function stableStringify(obj: any) {
  // basic stable stringify: sort keys recursively
  const seen = new WeakSet();
  const sorter = (x: any): any => {
    if (x && typeof x === "object") {
      if (seen.has(x)) return x;
      seen.add(x);
      if (Array.isArray(x)) return x.map(sorter);
      const keys = Object.keys(x).sort();
      const out: any = {};
      for (const k of keys) out[k] = sorter(x[k]);
      return out;
    }
    return x;
  };
  return JSON.stringify(sorter(obj));
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function readPrevProbe(probePath: string): Promise<{ hash: string } | null> {
  try {
    const txt = await fs.readFile(probePath, "utf8");
    const j = JSON.parse(txt);
    if (j && typeof j.hash === "string") return { hash: j.hash };
    return null;
  } catch {
    return null;
  }
}

async function writeProbe(probePath: string, data: any) {
  await fs.mkdir(path.dirname(probePath), { recursive: true });
  await fs.writeFile(probePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const clientId = requireEnv("BNET_CLIENT_ID");
  const clientSecret = requireEnv("BNET_CLIENT_SECRET");

  const token = await getAccessTokenUS(clientId, clientSecret);

  const API_BASE = "https://us.api.blizzard.com";
  const NAMESPACE = "static-us";
  const LOCALE = "en_US";

  // Small, stable endpoints that tend to change across patches/content updates.
  const urls = [
    `${API_BASE}/data/wow/item-class/index?namespace=${NAMESPACE}&locale=${LOCALE}`,
    `${API_BASE}/data/wow/playable-class/index?namespace=${NAMESPACE}&locale=${LOCALE}`,
    `${API_BASE}/data/wow/playable-specialization/index?namespace=${NAMESPACE}&locale=${LOCALE}`,
  ];

  const payloads = await Promise.all(urls.map((u) => fetchJson<any>(u, token)));

  const combined = {
    v: 1,
    at: new Date().toISOString(),
    urls,
    payloads,
  };

  const hash = sha256(stableStringify(combined.payloads));

  const probePath = path.join("public", "data", "wow", "items", "probe.json");
  const prev = await readPrevProbe(probePath);

  // Save the *new* probe each run so commits show when it changed.
  await writeProbe(probePath, {
    hash,
    checkedAt: combined.at,
    urls,
  });

  if (!prev || prev.hash !== hash) {
    console.log("🔁 Probe changed (or missing). Rebuild recommended.");
    process.exit(10);
  }

  console.log("✅ Probe unchanged. Skipping rebuild.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ probe failed:", err?.message ?? err);
  // if probe fails, safest is rebuild (so we don't miss updates)
  process.exit(10);
});
