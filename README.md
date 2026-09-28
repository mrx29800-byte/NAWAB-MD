# 👑 NAWAB-MD

**NAWAB-MD Multi-Device WhatsApp Bot** — phone-number pairing, group management, status/info, media search, stickers, tools, fun commands and optional AI/media-provider integrations.

**Owner:** NAWAB DEV  
**GitHub:** https://github.com/mrx29800-byte/NAWAB-MD  
**WhatsApp Channel:** https://whatsapp.com/channel/0029VbDamhwGufIs5YfKmd1i

## Included

- Phone-number pairing — no external pairing website
- Persistent multi-file WhatsApp session
- Automatic reconnect after normal connection drops
- Dynamic `.menu`
- Status commands
- Group admin commands
- Image → sticker and sticker → image
- YouTube search for `.play` / `.video`
- Optional authorized media download provider
- Optional OpenAI-compatible AI endpoint
- Optional welcome/goodbye and auto-reply
- Render/Docker/Termux files
- NAWAB-MD logo in `assets/NAWAB-MD.png`

## Commands

### Status / info
`.ping`, `.status`, `.alive`, `.uptime`, `.runtime`, `.speed`, `.system`, `.botinfo`, `.about`, `.owner`, `.repo`, `.channel`, `.jid`, `.time`, `.date`

### Group
`.groupinfo`, `.ginfo`, `.members`, `.admins`, `.tagall`, `.everyone`, `.mention`, `.hidetag`, `.add`, `.remove`, `.kick`, `.promote`, `.demote`, `.groupopen`, `.groupclose`, `.groupname`, `.groupdesc`, `.link`, `.grouplink`, `.delete`

### Media / tools
`.play`, `.ytmp3`, `.yta`, `.video`, `.ytmp4`, `.ytvideo`, `.sticker`, `.s`, `.toimg`, `.apk`, `.calc`, `.echo`, `.say`, `.reverse`, `.base64`, `.decode64`, `.json`

### AI / fun
`.ai`, `.gpt`, `.shayari`, `.joke`, `.quote`, `.8ball`, `.dice`, `.roll`, `.coin`, `.flip`, `.choose`, `.pick`, `.love`

### Owner
`.autoreply on/off`, `.welcome on/off`, `.goodbye on/off`, `.block`, `.unblock`, `.restart`

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Set `PAIRING_NUMBER` and `OWNER_NUMBER` in `.env` using digits only, including country code.

When the pairing code appears, on WhatsApp use:

**Settings → Linked devices → Link a device → Link with phone number**

## Optional integrations

### Media downloads
`.play` and `.video` always perform a YouTube search. Actual audio/video file sending requires an authorized downloader provider. Configure:

```env
GIFTED_API_KEY=your_key
```

Only download content you are authorized to download and follow the relevant platform terms.

### AI
Set an OpenAI-compatible endpoint:

```env
AI_API_URL=
AI_API_KEY=
AI_MODEL=
```

Without these variables `.ai` reports that the provider is not configured.

## Security

Never commit `.env`, `session/`, API keys, WhatsApp credentials or other secrets. If a secret was ever committed publicly, rotate it even after deleting the file.

## License

See `LICENSE`. NAWAB-MD is distributed under the included NAWAB-MD license terms.

> NAWAB-MD uses the Baileys library. WhatsApp and its trademarks belong to their respective owners. This project is not affiliated with or endorsed by WhatsApp/Meta.
