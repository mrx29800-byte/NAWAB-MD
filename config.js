require("dotenv").config();

const cleanNumber = (value = "") => String(value).replace(/[^0-9]/g, "");

module.exports = {
  BOT_NAME: process.env.BOT_NAME || "NAWAB-MD",
  PREFIX: process.env.PREFIX || ".",
  OWNER_NAME: process.env.OWNER_NAME || "NAWAB DEV",
  OWNER_NUMBER: cleanNumber(process.env.OWNER_NUMBER),
  PAIRING_NUMBER: cleanNumber(process.env.PAIRING_NUMBER),
  MODE: (process.env.MODE || "public").toLowerCase(),
  PORT: Number(process.env.PORT || 5000),
  NEWSLETTER_URL:
    process.env.NEWSLETTER_URL ||
    "https://whatsapp.com/channel/0029VbDamhwGufIs5YfKmd1i",
  BOT_REPO:
    process.env.BOT_REPO ||
    "https://github.com/mrx29800-byte/NAWAB-MD",
  STARTING_MESSAGE:
    String(process.env.STARTING_MESSAGE || "true").toLowerCase() === "true",
  GIFTED_API_KEY: process.env.GIFTED_API_KEY || "",
  GIFTED_API_BASE:
    process.env.GIFTED_API_BASE || "https://api.gifted.co.ke"
};
