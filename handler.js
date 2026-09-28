const {
  downloadContentFromMessage,
  jidNormalizedUser,
  getContentType
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const yts = require('yt-search');
const sharp = require('sharp');
const { spawn } = require('child_process');
const config = require('./config');
const store = require('./lib/store');

// Active plugin loader: every .js file in ./plugins exporting
// { commands: ['name'], run(ctx) } becomes a live command.
const pluginsDir = path.join(__dirname, 'plugins');
const plugins = [];
if (fs.existsSync(pluginsDir)) {
  for (const file of fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))) {
    try {
      const plugin = require(path.join(pluginsDir, file));
      if (plugin && Array.isArray(plugin.commands) && typeof plugin.run === 'function') {
        plugins.push({ ...plugin, file });
      }
    } catch (e) {
      console.error(`Plugin load failed: ${file}`, e.message);
    }
  }
}
const pluginMap = new Map();
for (const plugin of plugins) {
  for (const command of plugin.commands) pluginMap.set(String(command).toLowerCase(), plugin);
}

const startedAt = Date.now();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jidNumber(jid='') { return jid.split('@')[0].split(':')[0]; }
function senderJid(msg) {
  return msg.key.participant || msg.key.remoteJid || '';
}
function isGroup(jid) { return jid.endsWith('@g.us'); }
function unwrapMessage(msg) {
  let m = msg.message || {};
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  return m;
}
function getText(msg) {
  const m = unwrapMessage(msg);
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption || '';
}
function mentionedJids(msg) {
  const m = unwrapMessage(msg);
  return m.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
function quotedMessage(msg) {
  const m = unwrapMessage(msg);
  return m.extendedTextMessage?.contextInfo?.quotedMessage;
}
function quotedParticipant(msg) {
  const m = unwrapMessage(msg);
  return m.extendedTextMessage?.contextInfo?.participant;
}
function formatDuration(ms) {
  const s = Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}
function isOwner(msg) {
  const n = jidNumber(senderJid(msg));
  return !!config.ownerNumber && n === config.ownerNumber;
}
function textFooter() {
  return `\n\n— ${config.botName} • ${config.ownerName}`;
}
async function reply(sock, jid, text, options={}) {
  return sock.sendMessage(jid, { text: text + textFooter(), ...options });
}
async function requireGroup(sock, jid) {
  if (!isGroup(jid)) {
    await reply(sock, jid, '❌ Ye command sirf WhatsApp group mein use hota hai.');
    return null;
  }
  return sock.groupMetadata(jid);
}
function adminSet(metadata) {
  return new Set(metadata.participants.filter(p => p.admin).map(p => jidNormalizedUser(p.id)));
}
async function requireAdmin(sock, msg, metadata, ownerAllowed=true) {
  if (ownerAllowed && isOwner(msg)) return true;
  const admins = adminSet(metadata);
  if (!admins.has(jidNormalizedUser(senderJid(msg)))) {
    await reply(sock, msg.key.remoteJid, '❌ Sirf group admins is command ko use kar sakte hain.');
    return false;
  }
  return true;
}
async function requireBotAdmin(sock, jid, metadata) {
  const bot = jidNormalizedUser(sock.user?.id || '');
  const p = metadata.participants.find(x => jidNormalizedUser(x.id) === bot);
  if (!p?.admin) {
    await reply(sock, jid, '❌ Pehle bot ko group admin banao.');
    return false;
  }
  return true;
}
function targetsFrom(msg, text, metadata) {
  const set = new Set([...mentionedJids(msg), ...text.split(/\s+/).filter(Boolean)
    .filter(x => /^\d{7,16}$/.test(x.replace(/[^\d]/g,'')))
    .map(x => x.replace(/[^\d]/g,'')+'@s.whatsapp.net')]);
  const q = quotedParticipant(msg);
  if (q) set.add(q);
  return [...set].filter(Boolean);
}
function menu() {
  const p=config.prefix;
  return `*╭━━━〔 👑 ${config.botName} 〕━━━╮*
┃ 👤 Owner: ${config.ownerName}
┃ ⚡ Prefix: ${p}
┃ 📡 Multi-Device: Baileys
┃ 📢 Channel: ${config.channel}
*╰━━━━━━━━━━━━━━━━━━━━╯*

*┌── STATUS / INFO ──┐*
│ ${p}ping
│ ${p}status
│ ${p}alive
│ ${p}uptime
│ ${p}speed
│ ${p}system
│ ${p}botinfo
│ ${p}about
│ ${p}owner
│ ${p}repo
│ ${p}channel
│ ${p}jid
│ ${p}time
│ ${p}date
*└──────────────────┘*

*┌── GROUP ADMIN ──┐*
│ ${p}groupinfo / ${p}ginfo
│ ${p}members
│ ${p}admins
│ ${p}tagall
│ ${p}hidetag
│ ${p}add <number>
│ ${p}remove / ${p}kick @user
│ ${p}promote @user
│ ${p}demote @user
│ ${p}groupopen
│ ${p}groupclose
│ ${p}groupname <name>
│ ${p}groupdesc <text>
│ ${p}link / ${p}grouplink
│ ${p}delete (reply)
*└──────────────────┘*

*┌── MEDIA / TOOLS ──┐*
│ ${p}play <song>
│ ${p}ytmp3 <song/link>
│ ${p}video <video>
│ ${p}ytmp4 <video/link>
│ ${p}sticker (reply image)
│ ${p}toimg (reply sticker)
│ ${p}apk <app>
│ ${p}calc <expression>
│ ${p}echo <text>
│ ${p}say <text>
│ ${p}reverse <text>
│ ${p}base64 <text>
│ ${p}decode64 <text>
│ ${p}json <text>
*└──────────────────┘*

*┌── AI / FUN ──┐*
│ ${p}ai <question>
│ ${p}shayari
│ ${p}joke
│ ${p}quote
│ ${p}8ball <question>
│ ${p}dice
│ ${p}coin
│ ${p}choose a|b|c
│ ${p}love name1|name2
*└──────────────────┘*

*┌── OWNER ──┐*
│ ${p}autoreply on/off
│ ${p}welcome on/off
│ ${p}goodbye on/off
│ ${p}block / ${p}unblock (reply/mention)
│ ${p}restart
│ ${p}plugins
*└──────────────────┘*

> Media download requires an authorized provider configured in .env.`;
}

async function downloadMessageMedia(msg) {
  const m=unwrapMessage(msg);
  let node=null, type=null;
  if (m.imageMessage) { node=m.imageMessage; type='image'; }
  else if (m.videoMessage) { node=m.videoMessage; type='video'; }
  else if (m.stickerMessage) { node=m.stickerMessage; type='sticker'; }
  else if (m.audioMessage) { node=m.audioMessage; type='audio'; }
  if (!node) return null;
  const stream=await downloadContentFromMessage(node,type);
  const chunks=[];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer:Buffer.concat(chunks), type, mimetype:node.mimetype || '' };
}
function resolveQuotedOrSelf(msg) {
  const q=quotedMessage(msg);
  if (q) return { message:q, key:{remoteJid:msg.key.remoteJid, fromMe:false, id:'quoted', participant:quotedParticipant(msg)} };
  return { message:unwrapMessage(msg), key:msg.key };
}
async function mediaApi(kind, query) {
  if (!config.giftedApiKey) return null;
  const endpoints = kind==='audio'
    ? ['https://api.giftedtech.co.ke/api/download/ytmp3','https://api.giftedtech.co.ke/api/download/ytaudio']
    : ['https://api.giftedtech.co.ke/api/download/ytmp4'];
  for (const url of endpoints) {
    try {
      const r=await axios.get(url,{params:{apikey:config.giftedApiKey,url:query},timeout:30000});
      const d=r.data?.result || r.data;
      const u=d?.download_url || d?.download || d?.url;
      if (u) return u;
    } catch {}
  }
  return null;
}
async function aiRequest(prompt) {
  if (!config.aiApiUrl || !config.aiApiKey) return null;
  const r=await axios.post(config.aiApiUrl,{
    model:config.aiModel,
    messages:[{role:'user',content:prompt}]
  },{headers:{Authorization:`Bearer ${config.aiApiKey}`,'Content-Type':'application/json'},timeout:45000});
  return r.data?.choices?.[0]?.message?.content || r.data?.output_text || null;
}
function safeCalc(expr) {
  if (!/^[0-9+\-*/%().\s]+$/.test(expr)) throw new Error('Only basic arithmetic is allowed.');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr})`)();
}

async function handleCommand(sock, msg) {
  const jid=msg.key.remoteJid;
  if (!jid || msg.key.fromMe) return;
  const body=getText(msg).trim();
  if (!body.startsWith(config.prefix)) return;

  const raw=body.slice(config.prefix.length).trim();
  const [name,...parts]=raw.split(/\s+/);
  const command=(name||'').toLowerCase();
  const text=parts.join(' ').trim();
  const start=Date.now();

  if (config.autoReply && !command) return;

  try {
    const plugin = pluginMap.get(command);
    if (plugin) {
      return await plugin.run({
        sock, msg, jid, command, text, parts, reply, config,
        isGroup: isGroup(jid), isOwner: () => isOwner(msg),
        startedAt, formatDuration, targetsFrom, requireGroup, requireAdmin, requireBotAdmin
      });
    }

    switch(command) {
      case 'menu': case 'help': case 'commands':
        return reply(sock,jid,menu());

      case 'ping': {
        await reply(sock,jid,'🏓 Pinging...');
        const ms=Date.now()-start;
        return reply(sock,jid,`🏓 Pong!\n⚡ Command latency: ${ms}ms`);
      }
      case 'status': case 'alive': case 'uptime': case 'runtime':
        return reply(sock,jid,`🟢 ${config.botName} is online.\n⏱️ Uptime: ${formatDuration(Date.now()-startedAt)}\n📦 Node: ${process.version}\n⚡ Prefix: ${config.prefix}`);
      case 'speed':
        return reply(sock,jid,`⚡ Response: ${Date.now()-start}ms\n⏱️ Uptime: ${formatDuration(Date.now()-startedAt)}`);
      case 'system':
        return reply(sock,jid,`🖥️ Platform: ${process.platform}\n🏗️ Arch: ${process.arch}\n🧠 RAM: ${(process.memoryUsage().rss/1024/1024).toFixed(1)} MB\n⏱️ Uptime: ${formatDuration(Date.now()-startedAt)}`);
      case 'botinfo': case 'about':
        return reply(sock,jid,`👑 ${config.botName}\nOwner: ${config.ownerName}\nPrefix: ${config.prefix}\nChannel: ${config.channel}\nRepo: ${config.repo}`);
      case 'owner':
        return reply(sock,jid,`👤 Owner: ${config.ownerName}\n📱 ${config.ownerNumber ? '+'+config.ownerNumber : 'Set OWNER_NUMBER in .env'}`);
      case 'repo':
        return reply(sock,jid,`🔗 GitHub: ${config.repo}`);
      case 'channel':
        return reply(sock,jid,`📢 Official WhatsApp Channel:\n${config.channel}`);
      case 'jid':
        return reply(sock,jid,`🆔 Chat JID: ${jid}\n👤 Sender: ${senderJid(msg)}`);
      case 'time':
        return reply(sock,jid,`🕒 ${new Date().toLocaleTimeString()}`);
      case 'date':
        return reply(sock,jid,`📅 ${new Date().toLocaleDateString()}`);

      case 'groupinfo': case 'ginfo': {
        const md=await requireGroup(sock,jid); if(!md) return;
        return reply(sock,jid,`👥 ${md.subject}\n🆔 ${md.id}\n👤 Members: ${md.participants.length}\n🛡️ Admins: ${md.participants.filter(x=>x.admin).length}\n📝 Description: ${md.desc || 'None'}`);
      }
      case 'members': {
        const md=await requireGroup(sock,jid); if(!md) return;
        return reply(sock,jid,`👥 Members: ${md.participants.length}\n`+md.participants.map((x,i)=>`${i+1}. @${jidNumber(x.id)}`).join('\n'),{mentions:md.participants.map(x=>x.id)});
      }
      case 'admins': {
        const md=await requireGroup(sock,jid); if(!md) return;
        const a=md.participants.filter(x=>x.admin);
        return reply(sock,jid,'🛡️ Group admins:\n'+a.map((x,i)=>`${i+1}. @${jidNumber(x.id)}`).join('\n'),{mentions:a.map(x=>x.id)});
      }
      case 'tagall': case 'everyone': case 'mention': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md)) return;
        const mentions=md.participants.map(x=>x.id);
        return reply(sock,jid,(text||'📢 Attention everyone!')+'\n\n'+mentions.map(x=>`@${jidNumber(x)}`).join(' '),{mentions});
      }
      case 'hidetag': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md)) return;
        const mentions=md.participants.map(x=>x.id);
        return reply(sock,jid,text||'📢 Attention everyone!',{mentions});
      }
      case 'add': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        const nums=text.split(/\s+/).map(x=>x.replace(/\D/g,'')).filter(x=>x.length>=7);
        if(!nums.length) return reply(sock,jid,`Usage: ${config.prefix}add 923001234567`);
        return reply(sock,jid,JSON.stringify(await sock.groupParticipantsUpdate(jid,nums.map(n=>n+'@s.whatsapp.net'),'add')));
      }
      case 'remove': case 'kick': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        const targets=targetsFrom(msg,text,md);
        if(!targets.length) return reply(sock,jid,'❌ Mention/reply to a user.');
        return reply(sock,jid,JSON.stringify(await sock.groupParticipantsUpdate(jid,targets,'remove')));
      }
      case 'promote': case 'demote': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        const targets=targetsFrom(msg,text,md);
        if(!targets.length) return reply(sock,jid,'❌ Mention/reply to a user.');
        return reply(sock,jid,JSON.stringify(await sock.groupParticipantsUpdate(jid,targets,command)));
      }
      case 'groupopen': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        await sock.groupSettingUpdate(jid,'not_announcement');
        return reply(sock,jid,'🔓 Group is now open for all members.');
      }
      case 'groupclose': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        await sock.groupSettingUpdate(jid,'announcement');
        return reply(sock,jid,'🔒 Group is now admin-only.');
      }
      case 'groupname': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}groupname New Name`);
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        await sock.groupUpdateSubject(jid,text); return reply(sock,jid,'✅ Group name updated.');
      }
      case 'groupdesc': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}groupdesc New description`);
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        await sock.groupUpdateDescription(jid,text); return reply(sock,jid,'✅ Group description updated.');
      }
      case 'link': case 'grouplink': {
        const md=await requireGroup(sock,jid); if(!md) return;
        if(!await requireAdmin(sock,msg,md) || !await requireBotAdmin(sock,jid,md)) return;
        return reply(sock,jid,`🔗 https://chat.whatsapp.com/${await sock.groupInviteCode(jid)}`);
      }
      case 'delete': {
        if(!isOwner(msg)) {
          const md=await requireGroup(sock,jid); if(md && !await requireAdmin(sock,msg,md)) return;
        }
        const q=msg.message?.extendedTextMessage?.contextInfo;
        if(!q?.stanzaId) return reply(sock,jid,'❌ Reply to the message you want to delete.');
        const key={remoteJid:jid,id:q.stanzaId,fromMe:false,participant:q.participant};
        return sock.sendMessage(jid,{delete:key});
      }

      case 'play': case 'ytmp3': case 'yta': {
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}play <song name or YouTube URL>`);
        const r=await yts(text);
        const v=r.videos?.[0];
        if(!v) return reply(sock,jid,'❌ No YouTube result found.');
        const direct=await mediaApi('audio',v.url);
        if(direct) return sock.sendMessage(jid,{audio:{url:direct},mimetype:'audio/mpeg',fileName:`${v.title.replace(/[\\/:*?"<>|]/g,'_')}.mp3`});
        return reply(sock,jid,`🎵 ${v.title}\n👤 ${v.author?.name || 'Unknown'}\n⏱️ ${v.timestamp}\n🔗 ${v.url}\n\nℹ️ Audio file download is not enabled until an authorized media provider is configured with GIFTED_API_KEY.`);
      }
      case 'video': case 'ytmp4': case 'ytvideo': {
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}video <video name or YouTube URL>`);
        const r=await yts(text); const v=r.videos?.[0];
        if(!v) return reply(sock,jid,'❌ No YouTube result found.');
        const direct=await mediaApi('video',v.url);
        if(direct) return sock.sendMessage(jid,{video:{url:direct},caption:`🎬 ${v.title}`});
        return reply(sock,jid,`🎬 ${v.title}\n⏱️ ${v.timestamp}\n🔗 ${v.url}\n\nℹ️ Video file download needs an authorized media provider in GIFTED_API_KEY.`);
      }
      case 'apk': {
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}apk <app name>`);
        return reply(sock,jid,`📦 APK search for: ${text}\n🔎 https://apkpure.com/search?q=${encodeURIComponent(text)}\n\nThis command returns a search page; it does not distribute modified or paid APKs.`);
      }
      case 'sticker': case 's': {
        const q=quotedMessage(msg); const source=q ? {message:q,key:{remoteJid:jid,fromMe:false,id:'q',participant:quotedParticipant(msg)}} : msg;
        const data=await downloadMessageMedia(source);
        if(!data || data.type!=='image') return reply(sock,jid,'❌ Reply to an image with .sticker');
        const webp=await sharp(data.buffer).resize({width:512,height:512,fit:'inside'}).webp({quality:80}).toBuffer();
        return sock.sendMessage(jid,{sticker:webp});
      }
      case 'toimg': {
        const q=quotedMessage(msg);
        if(!q?.stickerMessage) return reply(sock,jid,'❌ Reply to a sticker with .toimg');
        const source={message:q,key:{remoteJid:jid,fromMe:false,id:'q',participant:quotedParticipant(msg)}};
        const data=await downloadMessageMedia(source);
        const png=await sharp(data.buffer).png().toBuffer();
        return sock.sendMessage(jid,{image:png,caption:'🖼️ Sticker converted to image.'});
      }

      case 'calc': {
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}calc 25*4+10`);
        try { return reply(sock,jid,`🧮 ${text} = ${safeCalc(text)}`); } catch(e) { return reply(sock,jid,'❌ Invalid arithmetic expression.'); }
      }
      case 'echo': case 'say':
        return reply(sock,jid,text || '❌ Text required.');
      case 'reverse':
        return reply(sock,jid,text ? [...text].reverse().join('') : '❌ Text required.');
      case 'base64':
        return reply(sock,jid,text ? Buffer.from(text).toString('base64') : '❌ Text required.');
      case 'decode64':
        try { return reply(sock,jid,text ? Buffer.from(text,'base64').toString('utf8') : '❌ Text required.'); } catch { return reply(sock,jid,'❌ Invalid Base64.'); }
      case 'json':
        try { return reply(sock,jid,JSON.stringify(JSON.parse(text),null,2)); } catch { return reply(sock,jid,'❌ Invalid JSON.'); }

      case 'ai': case 'gpt': {
        if(!text) return reply(sock,jid,`Usage: ${config.prefix}ai <question>`);
        try {
          const answer=await aiRequest(text);
          return reply(sock,jid,answer || '🤖 AI is not configured. Add AI_API_URL, AI_API_KEY and AI_MODEL to .env.');
        } catch(e) { return reply(sock,jid,'❌ AI provider request failed. Check your AI environment variables.'); }
      }
      case 'shayari':
        return reply(sock,jid,'🌙 Dil ko sukoon chahiye to alfaaz kam aur dua zyada rakho.');
      case 'joke':
        return reply(sock,jid,'😂 Teacher: Homework kahan hai? Student: Sir, Wi‑Fi nahi tha… homework cloud mein tha.');
      case 'quote':
        return reply(sock,jid,'✨ Chhoti progress bhi progress hoti hai. Roz thora behtar bano.');
      case '8ball':
        return reply(sock,jid,'🎱 '+['Yes.','No.','Maybe.','Definitely.','Ask again later.','It looks promising.'][Math.floor(Math.random()*6)]);
      case 'dice': case 'roll':
        return reply(sock,jid,'🎲 '+(Math.floor(Math.random()*6)+1));
      case 'coin': case 'flip':
        return reply(sock,jid,'🪙 '+(Math.random()<0.5?'Heads':'Tails'));
      case 'choose': case 'pick': {
        const a=text.split('|').map(x=>x.trim()).filter(Boolean);
        return reply(sock,jid,a.length ? '🎯 '+a[Math.floor(Math.random()*a.length)] : `Usage: ${config.prefix}choose tea|coffee|juice`);
      }
      case 'love': {
        const a=text.split('|').map(x=>x.trim());
        if(a.length<2) return reply(sock,jid,`Usage: ${config.prefix}love Name1|Name2`);
        const score=Math.floor(Math.random()*101);
        return reply(sock,jid,`❤️ ${a[0]} + ${a[1]} = ${score}%`);
      }

      case 'autoreply': case 'auto': {
        if(!isOwner(msg)) return reply(sock,jid,'❌ Owner only.');
        const v=text.toLowerCase();
        if(!['on','off'].includes(v)) return reply(sock,jid,`Usage: ${config.prefix}autoreply on/off`);
        store.set('autoReply',v==='on'); config.autoReply=v==='on';
        return reply(sock,jid,`🤖 Auto reply ${v==='on'?'enabled':'disabled'}.`);
      }
      case 'welcome': case 'goodbye': {
        if(!isOwner(msg)) return reply(sock,jid,'❌ Owner only.');
        const v=text.toLowerCase();
        if(!['on','off'].includes(v)) return reply(sock,jid,`Usage: ${config.prefix}${command} on/off`);
        store.set(command,v==='on');
        if(command==='welcome') config.welcome=v==='on'; else config.goodbye=v==='on';
        return reply(sock,jid,`✅ ${command} ${v==='on'?'enabled':'disabled'}.`);
      }
      case 'block': case 'unblock': {
        if(!isOwner(msg)) return reply(sock,jid,'❌ Owner only.');
        const targets=targetsFrom(msg,text,{participants:[]});
        const t=targets[0] || (isGroup(jid)?null:jid);
        if(!t) return reply(sock,jid,'❌ Mention/reply to a user.');
        await sock.updateBlockStatus(t,command==='block'?'block':'unblock');
        return reply(sock,jid,`✅ ${command}ed ${t}`);
      }
      case 'restart':
        if(!isOwner(msg)) return reply(sock,jid,'❌ Owner only.');
        await reply(sock,jid,'♻️ Restarting NAWAB-MD...');
        setTimeout(()=>process.exit(0),500);
        return;

      case 'plugins': {
        const names = plugins.flatMap(p => p.commands.map(c => `${config.prefix}${c}`));
        return reply(sock,jid,`🧩 *Loaded Plugins*\n\n${names.length ? names.join('\n') : 'No plugins loaded.'}\n\n📦 Plugin files: ${plugins.length}`);
      }

      default:
        if(config.autoReply) {
          const responses={'hi':'Assalam-o-Alaikum! 👑','hello':'Hello! 👋','salam':'Wa Alaikum Assalam! 🤍','assalamualaikum':'Wa Alaikum Assalam! 🤍'};
          const r=responses[command];
          if(r) return reply(sock,jid,r);
        }
        return;
    }
  } catch(err) {
    console.error(`[${command}]`,err);
    return reply(sock,jid,`❌ Command error: ${err.message || 'Unknown error'}`);
  }
}

module.exports={handleCommand,getText,unwrapMessage};
