const { Client, LocalAuth } = require('whatsapp-web.js');
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: '/usr/bin/google-chrome-stable' // مسار الكروم على السيرفر
    }
});

// قاعدة بيانات بسيطة للمخالفات
let violations = {};

client.on('message', async msg => {
    const chat = await msg.getChat();
    const user = msg.author || msg.from;

    // فحص لو الشخص مكتوم
    if (violations[user]?.isMuted) {
        if (violations[user].muteUntil === 'permanent' || Date.now() < violations[user].muteUntil) {
            await msg.delete(true);
            return;
        } else {
            violations[user].isMuted = false;
        }
    }

    // فحص الشتائم باستخدام AI (للأعضاء فقط)
    const contact = await msg.getContact();
    if (!msg.fromMe && chat.isGroup) {
        const isToxic = await checkAI(msg.body);
        if (isToxic) {
            await handleMute(msg, user, chat);
        }
    }
});

async function checkAI(text) {
    try {
        const res = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `هل هذا النص سب أو شتم؟ أجب بـ (نعم) أو (لا): "${text}"` }]
        });
        return res.choices[0].message.content.includes("نعم");
    } catch (e) { return false; }
}

async function handleMute(msg, userId, chat) {
    if (!violations[userId]) violations[userId] = { count: 0 };
    violations[userId].count++;

    const levels = { 1: 10, 2: 15, 3: 30, 4: 60 };
    let time = levels[violations[userId].count] || 'permanent';

    violations[userId].isMuted = true;
    violations[userId].muteUntil = time === 'permanent' ? 'permanent' : Date.now() + (time * 60 * 1000);

    await msg.delete(true);
    let response = time === 'permanent' ? "تم كتمك نهائياً لتكرار الشتائم." : `تم كتمك لمدة ${time} دقيقة بسبب الشتيمة.`;
    chat.sendMessage(`⚠️ @${userId.split('@')[0]} ${response}`, { mentions: [userId] });
}

// تشغيل البوت وطلب كود الربط
client.initialize();

client.on('ready', () => console.log('✅ البوت شغال الآن!'));