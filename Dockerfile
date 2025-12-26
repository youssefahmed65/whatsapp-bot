FROM node:18-slim

# تثبيت متصفح كروم والاعتمادات اللازمة
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "index.js"]
