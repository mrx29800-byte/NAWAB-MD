module.exports = {
  commands: ['whoami', 'plugininfo'],
  async run({ sock, msg, jid, reply, config, isOwner, command }) {
    if (command === 'whoami') {
      const sender = msg.key.participant || msg.key.remoteJid || '';
      return reply(sock, jid, `👤 *WHO AM I?*\n\nJID: ${sender}\nOwner: ${isOwner() ? 'YES 👑' : 'NO'}`);
    }
    return reply(sock, jid, `🧩 *PLUGIN SYSTEM*\n\nBot: ${config.botName}\nPlugin directory: ./plugins\nFormat: { commands, run }\nStatus: ACTIVE`);
  }
};
