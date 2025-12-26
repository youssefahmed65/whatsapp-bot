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

// رقم هاتفك بالصيغة الدولية الصحيحة بدون علامة +
const phoneNumber = "201228905645"; 

async function startBot() {
    // تم تغيير اسم المجلد إلى session_v3 لضمان جلسة ربط جديدة تماماً
    const { state, saveCreds } = await useMultiFileAuthState('session_v3');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // إعدادات المتصفح ضرورية لنجاح الربط بالكود
        browser: ["Ubuntu", "Chrome", "20.0.0"],
    });

    // طلب كود الربط إذا لم يكن الجهاز مسجلاً
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\x1b[32m\n=== كود الربط الجديد الخاص بك هو: ${code} ===\n\x1b[0m`);
            } catch (error) {
                console.error("خطأ في طلب كود الربط:", error);
            }
        }, 5000); // زيادة وقت الانتظار قليلاً لضمان استقرار السيرفر
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("إعادة الاتصال...");
                startBot();
            }
        } else if (connection === "open") {
            console.log("✅ ✅ تم ربط الواتساب بنجاح! البوت الآن نشط.");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        // هنا يمكنك تتبع ID المجموعة لاحقاً من اللوجز
        const from = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`رسالة من ${from}: ${messageText}`);

        if (messageText === "ping") {
            await sock.sendMessage(from, { text: "pong! 🏓" });
        }
    });
}

startBot();
