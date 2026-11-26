# Bot start (shuru se)

## 1) Local CLI — Telegram ke bina dekho

```bash
cd firebase-panel-bot
npm install
npm run cli:demo
npm run cli -- --url "https://YOUR.firebaseio.com" --key "YOUR_DB_SECRET"
npm run cli -- /path/to/panels.txt
```

## 2) Telegram bot

```bash
export TELEGRAM_BOT_TOKEN="botfather se token"
npm start
```

Telegram mein: `/start` → `/add URL|key` ya file + caption `addtxt` → `/fetch` → `/online`

## 3) APK (same logic, phone UI)

`shuruaat-app/` — release **1.0.5**
