const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { OpenAI } = require('openai');

// 1. هنا تضع الـ ID الذي نسخته من الـ Logs (تأكد من وجود @g.us)
//const myGroupID = '1203630123456789@g.us'; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('البوت جاهز للعمل!');
});

// 2. هذا هو الجزء المسؤول عن استقبال الرسائل وفلترتها
client.on('message', async msg => {
    
    // سطر الطباعة هذا سيساعدك دائماً في معرفة الـ ID لأي جروب ترسل فيه
    console.log(`رسالة من: ${msg.from}`);

    // الشرط: لو الرسالة مش من الجروب اللي حددناه فوق، البوت يتوقف فوراً
    if (msg.from !== myGroupID) {
        return; 
    }

    // --- بداية كود تحليل الذكاء الاصطناعي والحذف (ضع كود ChatGPT هنا) ---
    // if (msg.body.includes('شتيمة')) { await msg.delete(true); }
    // --- نهاية كود التحليل ---
});

client.initialize();

