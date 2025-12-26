# استخدام نسخة Node.js خفيفة
FROM node:18-slim

# إنشاء مجلد العمل
WORKDIR /app

# تثبيت الاعتمادات الأساسية فقط (بدون كروم)
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# نسخ ملفات الـ package
COPY package*.json ./

# تثبيت المكتبات
RUN npm install

# نسخ باقي الملفات
COPY . .

# تشغيل البوت
CMD ["npm", "start"]
