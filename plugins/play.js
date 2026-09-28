const axios = require("axios");
const yts = require("yt-search");
const config = require("../config");

async function tryGifted(endpoint, videoUrl) {
  if (!config.GIFTED_API_KEY) return null;

  const url =
    `${config.GIFTED_API_BASE}/api/download/${endpoint}` +
    `?apikey=${encodeURIComponent(config.GIFTED_API_KEY)}` +
    `&url=${encodeURIComponent(videoUrl)}`;

  const res = await axios.get(url, { timeout: 30000 });
  return res.data;
}

module.exports = {
  pattern: "play",
  aliases: ["ytmp3", "yta"],
  description: "Search YouTube and optionally download audio.",
  async handler({ sock, message, args }) {
    const q = args.join(" ").trim();
    const jid = message.key.remoteJid;

    if (!q) {
      return sock.sendMessage(jid, {
        text: `Usage: ${config.PREFIX}play <song name>`
      });
    }

    const result = await yts(q);
    const video = result.videos?.[0];

    if (!video) {
      return sock.sendMessage(jid, { text: "❌ No YouTube result found." });
    }

    const caption = [
      `🎵 *${video.title}*`,
      `👤 ${video.author?.name || "Unknown"}`,
      `⏱️ ${video.timestamp || "Unknown"}`,
      "",
      `🔗 ${video.url}`
    ].join("\n");

    if (!config.GIFTED_API_KEY) {
      return sock.sendMessage(jid, {
        text:
          caption +
          `\n\nℹ️ Download API is not configured. Add GIFTED_API_KEY in .env to enable server-side audio downloads.`
      });
    }

    try {
      const endpoints = ["ytmp3v2", "ytaudio", "yta", "ytmp3", "savetubemp3", "savemp3"];
      let data = null;

      for (const endpoint of endpoints) {
        try {
          data = await tryGifted(endpoint, video.url);
          if (data) break;
        } catch (_) {}
      }

      const downloadUrl =
        data?.result?.download_url ||
        data?.download_url ||
        data?.data?.download_url ||
        data?.result?.url ||
        data?.url;

      if (!downloadUrl) {
        return sock.sendMessage(jid, {
          text: caption + "\n\n❌ The configured download service did not return an audio URL."
        });
      }

      await sock.sendMessage(jid, {
        audio: { url: downloadUrl },
        mimetype: "audio/mpeg",
        fileName: `${video.title.replace(/[\\/:*?"<>|]/g, "_")}.mp3`
      });
    } catch (error) {
      await sock.sendMessage(jid, {
        text:
          caption +
          `\n\n❌ Download failed: ${error?.message || "unknown error"}`
      });
    }
  }
};
