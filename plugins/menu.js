const config = require("../config");

module.exports = {
  pattern: "menu",
  aliases: ["help", "commands"],
  description: "Show bot commands.",
  async handler({ sock, message, commands }) {
    const body = [
      `╭━━〔 👑 ${config.BOT_NAME} 〕━━╮`,
      `│`,
      `│ 🏓 ${config.PREFIX}ping`,
      `│ 📋 ${config.PREFIX}menu`,
      `│ 🎵 ${config.PREFIX}play <song name>`,
      `│ ℹ️ ${config.PREFIX}about`,
      `│`,
      `│ 📢 Updates:`,
      `│ ${config.NEWSLETTER_URL}`,
      `│`,
      `│ Commands loaded: ${commands.length}`,
      `╰━━━━━━━━━━━━━━━━━━━━╯`
    ].join("\n");

    await sock.sendMessage(message.key.remoteJid, { text: body });
  }
};
