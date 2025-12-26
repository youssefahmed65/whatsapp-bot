const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

const phoneNumber = "201228905645"; 

async function startBot() {
    // تغيير اسم الفولدر لمرة أخيرة لضمان تصفير الجلسة تماماً
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
        // التعديل السحري: جعل الواتساب يعتقد أنك تربط من جهاز Mac
        browser: ["Mac OS", "Chrome", "10.15.7"],
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                // طلب الكود بدون أي إضافات يدوية
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\x1b[32m\n=== الكود الجديد (جربه الآن): ${code} ===\n\x1b[0m`);
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
            console.log("✅ ✅ مبروك! تم الربط بنجاح.");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        console.log(`رسالة من ${from}`); // هذا سيظهر لك الـ ID الخاص بالمجموعة
    });
}

startBot();
