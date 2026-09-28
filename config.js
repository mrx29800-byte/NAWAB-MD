const path = require('path');
require('dotenv').config();

const channel = process.env.CHANNEL_URL || 'https://whatsapp.com/channel/0029VbDamhwGufIs5YfKmd1i';
const repo = process.env.REPO_URL || 'https://github.com/mrx29800-byte/NAWAB-MD';

module.exports = {
  botName: process.env.BOT_NAME || 'NAWAB-MD',
  ownerName: process.env.OWNER_NAME || 'NAWAB DEV',
  ownerNumber: (process.env.OWNER_NUMBER || process.env.PHONE_NUMBER || '').replace(/\D/g, ''),
  pairingNumber: (process.env.PAIRING_NUMBER || process.env.PHONE_NUMBER || '').replace(/\D/g, ''),
  prefix: process.env.PREFIX || '.',
  channel,
  repo,
  port: Number(process.env.PORT || 3000),
  sessionDir: path.resolve(process.env.SESSION_DIR || './session'),
  autoReply: process.env.AUTO_REPLY === 'true',
  welcome: process.env.WELCOME === 'true',
  goodbye: process.env.GOODBYE === 'true',
  giftedApiKey: process.env.GIFTED_API_KEY || '',
  aiApiUrl: process.env.AI_API_URL || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'default'
};
