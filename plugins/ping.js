module.exports = {
  pattern: "ping",
  aliases: ["p"],
  description: "Check bot response time.",
  async handler({ sock, message }) {
    const started = Date.now();
    const sent = await sock.sendMessage(message.key.remoteJid, {
      text: "🏓 Pinging..."
    });
    const ms = Date.now() - started;
    await sock.sendMessage(message.key.remoteJid, {
      text: `🏓 *NAWAB-MD*\n⚡ Response: ${ms} ms`,
      edit: sent.key
    });
  }
};
