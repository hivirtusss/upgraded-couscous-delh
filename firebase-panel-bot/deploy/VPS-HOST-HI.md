# VPS par bot 24×7 (Hostinger)

## One-time deploy (apne PC se)

```bash
cd firebase-panel-bot
export DEPLOY_SSH_PASSWORD='your-root-password'
export TELEGRAM_BOT_TOKEN='your-bot-token'
python3 deploy/remote-deploy.py
```

Server: `147.79.67.133` · user `root`

## Check status

```bash
ssh root@147.79.67.133
systemctl status panel-search-bot
journalctl -u panel-search-bot -f
```

## Restart

```bash
systemctl restart panel-search-bot
```

Panels data: `/opt/panel-search-bot/.bot-data/panels.json`

**Security:** root password chat mein mat bhejo — Hostinger se reset karo deploy ke baad.
