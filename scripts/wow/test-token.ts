import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const id = process.env.BLIZZARD_CLIENT_ID;
const secret = process.env.BLIZZARD_CLIENT_SECRET;

if (!id || !secret) {
  console.error("Missing Blizzard credentials.");
  process.exit(1);
}

async function main() {
  const tokenRes = await fetch(
    "https://us.battle.net/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    }
  );

  const { access_token } = await tokenRes.json();

  const itemRes = await fetch(
    `https://us.api.blizzard.com/data/wow/item/19019?namespace=static-us&locale=en_US`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  const item = await itemRes.json();

  const simplified = {
    id: item.id,
    name: item.name,
    slot: item.inventory_type?.type,
    ilvl: item.level,
    stats:
      item.preview_item?.stats?.map((s: any) => ({
        type: s.type?.type,
        value: s.value,
      })) ?? [],
  };

  console.log("Simplified output:");
  console.log(JSON.stringify(simplified, null, 2));
}

main();
