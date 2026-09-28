require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const config = require("./config");
const { loadPlugins, getCommand, listCommands } = require("./lib/commands");
const { getText } = require("./lib/utils");

const logger = pino({ level: "silent" });
const sessionDir = path.join(__dirname, "session");

let sock;

const app = express();
app.get("/", (_req, res) => {
  res.status(200).send(`${config.BOT_NAME} is running.`);
});
app.get("/health", (_req, res) => {
  res.json({
    status: "alive",
    bot: config.BOT_NAME,
    uptime: process.uptime(),
    connected: Boolean(sock?.user)
  });
});
app.listen(config.PORT, () => {
  console.log(`🌐 ${config.BOT_NAME} health server: ${config.PORT}`);
});

loadPlugins();
console.log(`🧩 Loaded commands: ${listCommands().join(", ")}`);

function normalizePrefix(text) {
  if (!text.startsWith(config.PREFIX)) return null;
  const raw = text.slice(config.PREFIX.length).trim();
  if (!raw) return null;

  const parts = raw.split(/\s+/);
  return {
    name: parts.shift().toLowerCase(),
    args: parts
  };
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: [config.BOT_NAME, "Chrome", "1.0.0"],
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(`✅ ${config.BOT_NAME} connected to WhatsApp.`);

      if (config.STARTING_MESSAGE && sock.user?.id) {
        const jid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        const text = [
          `╭━━〔 👑 ${config.BOT_NAME} 〕━━╮`,
          "│",
          "│ ✅ Connected successfully!",
          `│ 🧩 Commands: ${listCommands().length}`,
          "│ 🔗 Pairing: Phone number",
          `│ 📢 ${config.NEWSLETTER_URL}`,
          "│",
          "╰━━━━━━━━━━━━━━━━━━━━╯"
        ].join("\n");

        try {
          await sock.sendMessage(jid, { text });
        } catch (_) {}
      }
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.error("❌ WhatsApp logged out. Delete session/ and pair again.");
        process.exit(1);
      }

      console.log("🔄 Connection closed; reconnecting...");
      setTimeout(start, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages?.[0];
    if (!message?.message || message.key?.fromMe) return;

    const text = getText(message);
    const parsed = normalizePrefix(text);
    if (!parsed) return;

    const command = getCommand(parsed.name);
    if (!command) return;

    try {
      await command.handler({
        sock,
        message,
        args: parsed.args,
        commands: listCommands(),
        config
      });
    } catch (error) {
      console.error(`Command ${parsed.name} error:`, error);
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ Command error: ${error?.message || "unknown error"}`
      });
    }
  });

  // Phone-number pairing. No external pairing website is used.
  if (!state.creds.registered) {
    if (!config.PAIRING_NUMBER) {
      console.log(
        "⚠️ Set PAIRING_NUMBER in .env, then restart. Example: 923001234567"
      );
      return;
    }

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.PAIRING_NUMBER);
        console.log("\n========================================");
        console.log(`📱 ${config.BOT_NAME} PAIRING CODE: ${code}`);
        console.log("========================================");
        console.log(
          "Open WhatsApp > Linked devices > Link a device > Link with phone number."
        );
      } catch (error) {
        console.error("❌ Could not generate pairing code:", error?.message || error);
      }
    }, 2500);
  }
}

start().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
