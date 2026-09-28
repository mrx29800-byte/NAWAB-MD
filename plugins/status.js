module.exports = {
  commands: ['health', 'ram', 'nodeinfo'],
  async run({ sock, jid, reply, config, startedAt, formatDuration, command }) {
    if (command === 'health') {
      return reply(sock, jid, `🟢 *${config.botName} HEALTH*\n\nStatus: ONLINE\nUptime: ${formatDuration(Date.now() - startedAt)}\nNode: ${process.version}`);
    }
    if (command === 'ram') {
      const m = process.memoryUsage();
      return reply(sock, jid, `🧠 *RAM USAGE*\n\nRSS: ${(m.rss/1024/1024).toFixed(1)} MB\nHeap: ${(m.heapUsed/1024/1024).toFixed(1)} / ${(m.heapTotal/1024/1024).toFixed(1)} MB`);
    }
    return reply(sock, jid, `🟢 *NODE INFO*\n\nVersion: ${process.version}\nPlatform: ${process.platform}\nArch: ${process.arch}\nUptime: ${formatDuration(Date.now() - startedAt)}`);
  }
};
