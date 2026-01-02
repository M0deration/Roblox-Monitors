const axios = require("axios");

// ================= CONFIG =================
const ITEMS = [
  { id: 138860886392452, maxPrice: 90 },
  { id: 98839119772267, maxPrice: 90 }
];

const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
const REQUEST_SPACING = 2000; // 2 seconds between item checks
const RATE_LIMIT_COOLDOWN = 10 * 60 * 1000; // 10 minutes
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
// =========================================

// axios instance (DO NOT use global axios)
const client = axios.create({
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  },
  timeout: 10000
});

// state
const itemStatus = {};     // on-sale state
const cooldownUntil = {};  // per-item cooldown timestamp

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function checkItem(item) {
  // cooldown check
  if (cooldownUntil[item.id] && Date.now() < cooldownUntil[item.id]) {
    return;
  }

  try {
    const res = await client.post(
      "https://catalog.roblox.com/v1/catalog/items/details",
      {
        items: [{ itemType: "Asset", id: item.id }]
      }
    );

    const data = res.data?.data?.[0];
    if (!data) return;

    const name = data.name;
    const isOnSale = data.priceStatus === "OnSale";
    const price = data.price;

    if (itemStatus[item.id] === undefined) {
      itemStatus[item.id] = false;
    }

    // alert condition
    if (
      isOnSale &&
      price !== null &&
      price <= item.maxPrice &&
      itemStatus[item.id] === false
    ) {
      const thumbnail = await getThumbnail(item.id);
      await sendDiscordAlert(item.id, name, price, thumbnail);
      itemStatus[item.id] = true;
    }

    // reset state when offsale
    if (!isOnSale) {
      itemStatus[item.id] = false;
    }

    console.log(
      `[OK] ${name} | Sale: ${isOnSale} | Price: ${price ?? "N/A"}`
    );

  } catch (err) {
    if (err.response?.status === 429) {
      console.warn(`[429] Cooling down item ${item.id}`);
      cooldownUntil[item.id] = Date.now() + RATE_LIMIT_COOLDOWN;
    } else {
      console.error(
        `[ERROR] ${item.id}`,
        err.response?.status,
        err.message
      );
    }
  }

  await sleep(REQUEST_SPACING);
}

async function getThumbnail(assetId) {
  try {
    const res = await client.get(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`
    );
    return res.data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

async function sendDiscordAlert(id, name, price, thumbnail) {
  if (!DISCORD_WEBHOOK) return;

  await client.post(DISCORD_WEBHOOK, {
    embeds: [
      {
        title: "🚨 ITEM ON SALE",
        description: `**${name}**`,
        thumbnail: thumbnail ? { url: thumbnail } : undefined,
        fields: [
          { name: "Asset ID", value: String(id), inline: true },
          { name: "Price", value: `${price} Robux`, inline: true }
        ],
        color: 0xffc107,
        footer: { text: "Free Safe Monitor" },
        timestamp: new Date().toISOString()
      }
    ]
  });
}

// ================= MAIN LOOP =================
(async () => {
  console.log("✅ Roblox Item Monitor started (FREE MODE)");

  while (true) {
    for (const item of ITEMS) {
      await checkItem(item);
    }
    await sleep(CHECK_INTERVAL);
  }
})();
