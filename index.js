const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // سنستخدم كود الربط بدلاً من QR
        browser: ["Ubuntu", "Chrome", "20.0.0"]
    });

    // كود الربط - سيظهر في Logs موقع Koyeb
    if (!sock.authState.creds.registered) {
        // تأكد من وضع رقمك هنا بمفتاح الدولة بدون + (مثال: 2010xxxxxxxx)
        const phoneNumber = "201012345678"; 
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n\n=== كود الربط الخاص بك هو: ${code} ===\n\n`);
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const from = msg.key.remoteJid;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: text }],
            });

            const reply = response.choices[0].message.content;
            await sock.sendMessage(from, { text: reply }, { quoted: msg });
        } catch (error) {
            console.error("خطأ في OpenAI:", error.message);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ البوت متصل الآن وجاهز للرد على الجميع!');
        }
    });
}

startBot();
