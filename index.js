const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const http = require("http");

// ==========================================
// 1. الإعدادات الأساسية (تعديلك هنا)
// ==========================================
const phoneNumber = "201228905645"; 
// اترك targetGroupID كما هو، وسنغيره بعد أن تحصل عليه من اللوجز
let targetGroupID = "120363000000000000@g.us"; 

let mutedUsers = new Map();     
let warningCount = new Map();   
let insultCounter = new Map();  

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // تعريف البوت كجهاز ثابت لمنع فك الربط السريع
        browser: ["Koyeb Server", "Chrome", "1.0.0"],
    });

    // إظهار كود الربط في اللوجز
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\x1b[32m\n=== كود الربط الخاص بك: ${code} ===\n\x1b[0m`);
            } catch (err) { console.error("خطأ في طلب الكود:", err); }
        }, 10000); // مهلة 10 ثوانٍ لضمان استقرار الاتصال أولاً
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ تم الاتصال بنجاح! البوت يعمل الآن.");
        }
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔄 جاري إعادة الاتصال...");
                startBot();
            }
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const messageText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // طباعة اللوجز لمعرفة ID الجروب
        console.log(`[لوج] رسالة من: ${from} | النص: ${messageText}`);

        if (from === targetGroupID) {
            const groupMetadata = await sock.groupMetadata(from);
            const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;

            // 1. نظام حذف رسائل المكتومين
            if (mutedUsers.has(sender)) {
                await sock.sendMessage(from, { delete: msg.key });
                return;
            }

            // 2. نظام الشتائم (قائمة بسيطة للتحربة)
            const badWords = ["شتم", "حيوان", "كلب"]; 
            if (badWords.some(word => messageText.includes(word)) && !isAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
                
                let insults = (insultCounter.get(sender) || 0) + 1;
                if (insults < 3) {
                    insultCounter.set(sender, insults);
                    await sock.sendMessage(from, { text: `⚠️ تنبيه @${sender.split('@')[0]}: محاولة شتم (${insults}/3).`, mentions: [sender] });
                } else {
                    insultCounter.set(sender, 0);
                    let warnings = (warningCount.get(sender) || 0) + 1;
                    warningCount.set(sender, warnings);
                    
                    if (warnings >= 4) {
                        await sock.sendMessage(from, { text: `🚫 طرد نهائي لـ @${sender.split('@')[0]} لتجاوز الإنذارات.`, mentions: [sender] });
                        await sock.groupParticipantsUpdate(from, [sender], "remove");
                    } else {
                        mutedUsers.set(sender, true);
                        await sock.sendMessage(from, { text: `🚨 إنذار (${warnings}/4) لـ @${sender.split('@')[0]} وكتم 5 دقائق.`, mentions: [sender] });
                        setTimeout(() => { mutedUsers.delete(sender); }, 5 * 60000);
                    }
                }
            }
        }
    });
}

// ==========================================
// 2. سيرفر الـ Health Check لمنصة Koyeb
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Koyeb Bot is Alive\n');
});

// Koyeb تستمع بشكل افتراضي على Port 8000
server.listen(process.env.PORT || 8000, () => {
    console.log('📡 سيرفر التثبيت يعمل على منفذ 8000');
    startBot(); 
});
