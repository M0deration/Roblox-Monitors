const axios = require("axios");

// ===== CONFIG =====
const ITEMS = [
  { id: 138860886392452, maxPrice: 90 },
  { id: 98839119772267, maxPrice: 90 },
  { id: 11370430006, maxPrice: 5 }
];

const CHECK_INTERVAL = 10 * 1000;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
// ==================

let index = 0;
const itemStatus = {};

async function checkItem(item) {
  try {
    const res = await axios.get(
      `https://economy.roblox.com/v2/assets/${item.id}/details`
    );

    const data = res.data;
    const isOnSale = data.IsForSale;
    const price = data.Price;
    const name = data.Name;

    if (!itemStatus[item.id]) itemStatus[item.id] = false;

    if (isOnSale && !itemStatus[item.id] && price <= item.maxPrice) {
      const thumbnail = await getThumbnail(item.id);
      await sendDiscordAlert(item.id, name, price, thumbnail);
      itemStatus[item.id] = true;
    }

    if (!isOnSale) itemStatus[item.id] = false;

  } catch {
    console.log(`Error checking ${item.id}`);
  }
}

async function getThumbnail(assetId) {
  const res = await axios.get(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`
  );
  return res.data.data[0].imageUrl;
}

async function sendDiscordAlert(id, name, price, thumbnail) {
  await axios.post(DISCORD_WEBHOOK, {
    embeds: [
      {
        title: "🚨 Item On Sale",
        description: `**${name}**`,
        thumbnail: { url: thumbnail },
        fields: [
          { name: "Asset ID", value: id.toString(), inline: true },
          { name: "Price", value: `${price} Robux`, inline: true }
        ],
        color: 0xffc107
      }
    ]
  });
}

setInterval(() => {
  checkItem(ITEMS[index]);
  index = (index + 1) % ITEMS.length;
}, CHECK_INTERVAL);

console.log("Monitoring items...");
