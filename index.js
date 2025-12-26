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
const targetGroupID = "120363000000000000@g.us"; // استبدله بالـ ID الحقيقي بعد أول رسالة

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
        browser: ["Mac OS", "Chrome", "10.15.7"],
    });

    // إظهار كود الربط
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\x1b[32m\n=== كود الربط الخاص بك: ${code} ===\n\x1b[0m`);
            } catch (err) { console.error("خطأ في طلب الكود:", err); }
        }, 5000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") console.log("✅ تم الاتصال بنجاح! البوت الآن يراقب المجموعة.");
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const messageText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // طباعة اللوجز لمعرفة الـ ID
        console.log(`[رسالة] من: ${from} | النص: ${messageText}`);

        if (from === targetGroupID) {
            const groupMetadata = await sock.groupMetadata(from);
            const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;

            // 1. مسح رسائل المكتومين
            if (mutedUsers.has(sender)) {
                await sock.sendMessage(from, { delete: msg.key });
                return;
            }

            // 2. نظام الشتائم (3 محاولات = 1 إنذار) - لغير المشرفين
            const badWords = ["شتم", "حيوان", "وسخ", "كلب", "غبي", "زفت"]; 
            if (badWords.some(word => messageText.includes(word)) && !isAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
                let insults = (insultCounter.get(sender)
