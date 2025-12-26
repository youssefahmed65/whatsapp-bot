const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

// ==========================================
// إعدادات البوت (تعديلك هنا)
// ==========================================
const phoneNumber = "201228905645"; // رقمك

// في البداية اترك هذا كما هو، وبعد الربط وإرسال رسالة في المجموعة
// خذ الـ ID من اللوجز وضعه هنا بدلاً من الرقم الموجود
const targetGroupID = "120363000000000000@g.us"; 
// ==========================================

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_final');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Mac OS", "Chrome", "10.15.7"],
    });

    // طلب كود الربط لو لسه مخلصتش ربط
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\x1b[32m\n=== كود الربط الخاص بك: ${code} ===\n\x1b[0m`);
            } catch (err) {
                console.error("خطأ في الطلب:", err);
            }
        }, 5000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ ✅ تم الاتصال بنجاح! السيرفر الآن يراقب الرسائل.");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // السطر ده هو اللي هيخليك تشوف الـ ID في الـ Logs
        console.log(`[رسالة جديدة] من: ${from} | النص: ${messageText}`);

        // البوت هيرد "فقط" لو الـ ID اللي فوق صح
        if (from === targetGroupID) {
            if (messageText === "بوت") {
                await sock.sendMessage(from, { text: "أنا شغال وبسمع أوامرك في المجموعة دي! 🫡" });
            }
        }
    });
}

// كود تثبيت البوت ومنع Koyeb من إغلاقه
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is Alive!');
}).listen(process.env.PORT || 8000);

// تشغيل البوت
startBot();

