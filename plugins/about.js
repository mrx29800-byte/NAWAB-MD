const config = require("../config");

module.exports = {
  pattern: "about",
  aliases: ["bot"],
  description: "Show bot information.",
  async handler({ sock, message }) {
    const text = [
      `🤖 *${config.BOT_NAME}*`,
      "",
      `👑 Owner: ${config.OWNER_NAME}`,
      `📦 Repo: ${config.BOT_REPO}`,
      `📢 Channel: ${config.NEWSLETTER_URL}`,
      `🔗 Pairing: Phone number`,
      "",
      "NAWAB-MD is running from its local source."
    ].join("\n");

    await sock.sendMessage(message.key.remoteJid, { text });
  }
};
