FROM node:18-slim

# تثبيت أداة git لأن المكتبات محتاجة تحمل ملفات من جيت هاب
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
