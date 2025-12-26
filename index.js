const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

// رقم هاتفك بالصيغة الصحيحة (بدون + وبدون أصفار في البداية)
const phoneNumber = "201228905645"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // سنستخدم كود الربط بدلاً من QR
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.0"],
    });

    // طلب كود الربط إذا لم يكن مسجلاً
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\x1b[32m\n=== كود الربط الخاص بك هو: ${code} ===\n\x1b[0m`);
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("تم قطع الاتصال، جاري إعادة المحاولة...", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ تم ربط الواتساب بنجاح! البوت يعمل الآن.");
        }
    });

    // هنا يمكنك إضافة أوامر البوت لاحقاً
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (messageText === "ping") {
            await sock.sendMessage(msg.key.remoteJid, { text: "pong! 🏓" });
        }
    });
}

startBot();
