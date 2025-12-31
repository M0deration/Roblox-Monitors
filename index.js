const axios = require("axios");

// ===== CONFIG =====
const ITEMS = [
  { id: 138860886392452, maxPrice: 90 },
  { id: 98839119772267, maxPrice: 90 }
];

const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const ITEMS_PER_CHECK = 2; // Check 2 items each interval
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
// ==================

// Roblox requires a User-Agent
axios.defaults.headers.common["User-Agent"] =
  "Mozilla/5.0 (compatible; RobloxItemMonitor/1.0)";
axios.defaults.headers.common["Accept"] = "application/json";

let index = 0;
const itemStatus = {};

async function checkItem(item) {
  try {
    const res = await axios.get(
      `https://economy.roblox.com/v2/assets/${item.id}/details`,
      { timeout: 10000 }
    );

    const data = res.data;

    const isOnSale = data.IsForSale;
    const price = data.Price ?? data.PriceInRobux ?? data.LowestPrice ?? null;
    const name = data.Name || "Unknown Item";

    if (!itemStatus[item.id]) itemStatus[item.id] = false;

    if (isOnSale && price !== null && !itemStatus[item.id] && price <= item.maxPrice) {
      const thumbnail = await getThumbnail(item.id);
      await sendDiscordAlert(item.id, name, price, thumbnail);
      itemStatus[item.id] = true;
    }

    if (!isOnSale) itemStatus[item.id] = false;

    console.log(`[OK] ${name} (${item.id}) | Sale: ${isOnSale} | Price: ${price ?? "N/A"}`);

  } catch (err) {
    console.error(`[ERROR] ${item.id}`, err.response?.status, err.response?.data || err.message);
  }
}

async function getThumbnail(assetId) {
  try {
    const res = await axios.get(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`,
      { timeout: 10000 }
    );
    return res.data.data[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

async function sendDiscordAlert(id, name, price, thumbnail) {
  if (!DISCORD_WEBHOOK) return;

  await axios.post(DISCORD_WEBHOOK, {
    embeds: [
      {
        title: "🚨 Item On Sale",
        description: `**${name}**`,
        thumbnail: thumbnail ? { url: thumbnail } : undefined,
        fields: [
          { name: "Asset ID", value: id.toString(), inline: true },
          { name: "Price", value: `${price} Robux`, inline: true }
        ],
        color: 0xffc107,
        footer: { text: "Roblox Item Monitor" },
        timestamp: new Date().toISOString()
      }
    ]
  });
}

// ===== MAIN LOOP =====
(async () => {
  console.log("Monitoring items...");

  // Initial check for the first ITEMS_PER_CHECK items
  for (let i = 0; i < ITEMS_PER_CHECK; i++) {
    await checkItem(ITEMS[index]);
    index = (index + 1) % ITEMS.length;
  }

  setInterval(async () => {
    for (let i = 0; i < ITEMS_PER_CHECK; i++) {
      await checkItem(ITEMS[index]);
      index = (index + 1) % ITEMS.length;
    }
  }, CHECK_INTERVAL);
})();
