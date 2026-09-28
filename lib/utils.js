function getText(message) {
  const m = message?.message;
  if (!m) return "";

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  );
}

function unwrapJid(jid = "") {
  return jid.split(":")[0];
}

function numberFromJid(jid = "") {
  return unwrapJid(jid).replace(/[^0-9]/g, "");
}

module.exports = { getText, unwrapJid, numberFromJid };
