const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');
const pino=require('pino');
const express=require('express');
const readline=require('readline');
const fs=require('fs');
const config=require('./config');
const store=require('./lib/store');
const {handleCommand}=require('./handler');

config.autoReply=store.get('autoReply',config.autoReply);
config.welcome=store.get('welcome',config.welcome);
config.goodbye=store.get('goodbye',config.goodbye);

const app=express();
app.get('/',(_,res)=>res.status(200).json({
  bot:config.botName,status:'online',uptime:Math.floor(process.uptime()),
  channel:config.channel,repo:config.repo
}));
app.get('/health',(_,res)=>res.status(200).send('OK'));
app.listen(config.port,()=>console.log(`🌐 Health server: http://localhost:${config.port}`));

const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(resolve=>rl.question(q,resolve));
let starting=false;

async function start(){
  if(starting) return;
  starting=true;
  const {state,saveCreds}=await useMultiFileAuthState(config.sessionDir);
  let version;
  try { ({version}=await fetchLatestBaileysVersion()); }
  catch { version=undefined; }

  const sock=makeWASocket({
    ...(version?{version}:{}),
    logger:pino({level:process.env.LOG_LEVEL||'silent'}),
    printQRInTerminal:false,
    auth:state,
    browser:Browsers.ubuntu(config.botName),
    markOnlineOnConnect:false,
    syncFullHistory:false
  });

  sock.ev.on('creds.update',saveCreds);

  if(!state.creds.registered){
    let number=config.pairingNumber;
    if(!number) number=await ask('📱 WhatsApp number with country code: ');
    number=String(number).replace(/\D/g,'');
    if(!number) throw new Error('Invalid pairing number.');
    await new Promise(r=>setTimeout(r,2500));
    try {
      const code=await sock.requestPairingCode(number);
      console.log('\n==========================================');
      console.log(`👑 ${config.botName} PAIRING CODE: ${code}`);
      console.log('WhatsApp → Linked devices → Link with phone number');
      console.log('==========================================\n');
    } catch(e) {
      console.error('Pairing code error:',e.message);
    }
  }

  sock.ev.on('connection.update',async ({connection,lastDisconnect})=>{
    if(connection==='open'){
      starting=false;
      console.log(`✅ ${config.botName} connected.`);
      const me=jidNormalizedUser(sock.user?.id||'');
      if(me){
        await sock.sendMessage(me,{text:
          `👑 *${config.botName} CONNECTED*\n\n`+
          `Owner: ${config.ownerName}\n`+
          `Prefix: ${config.prefix}\n`+
          `Channel: ${config.channel}\n`+
          `Repo: ${config.repo}\n\n`+
          `Type ${config.prefix}menu to view commands.`
        }).catch(()=>{});
      }
    }
    if(connection==='close'){
      starting=false;
      const code=lastDisconnect?.error?.output?.statusCode;
      const loggedOut=code===DisconnectReason.loggedOut;
      console.log(`⚠️ Connection closed. loggedOut=${loggedOut}`);
      if(!loggedOut){
        setTimeout(()=>start().catch(e=>{starting=false;console.error(e)}),3000);
      } else {
        console.log('Session logged out. Delete session and pair again.');
      }
    }
  });

  sock.ev.on('messages.upsert',async ({type,messages})=>{
    if(type!=='notify') return;
    for(const msg of messages){
      if(!msg.message || msg.key.fromMe) continue;
      try { await handleCommand(sock,msg); } catch(e){ console.error('message handler:',e); }
    }
  });

  sock.ev.on('group-participants.update',async ({id,participants,action})=>{
    if(!config.welcome && !config.goodbye) return;
    try{
      const md=await sock.groupMetadata(id);
      if(action==='add' && config.welcome){
        const mentions=participants;
        await sock.sendMessage(id,{text:`👋 Welcome ${participants.map(x=>'@'+x.split('@')[0]).join(', ')} to *${md.subject}*!\n\nType ${config.prefix}menu for bot commands.`,mentions});
      }
      if(action==='remove' && config.goodbye){
        const mentions=participants;
        await sock.sendMessage(id,{text:`👋 Goodbye ${participants.map(x=>'@'+x.split('@')[0]).join(', ')}!`,mentions});
      }
    }catch(e){console.error('group event:',e.message)}
  });
}

process.on('uncaughtException',e=>console.error('Uncaught:',e));
process.on('unhandledRejection',e=>console.error('Unhandled:',e));
start().catch(e=>{console.error('Startup failed:',e);process.exit(1)});
