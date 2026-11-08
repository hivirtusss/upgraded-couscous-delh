# APK — Device ID + txt list (PIN / bina PIN)

## Txt file format

Har line ek device:

```
DEVICE_ANDROID_ID|PIN|label
```

| PIN field | Matlab |
|-----------|--------|
| khali | bina PIN |
| `open` / `nopin` | bina PIN |
| `1234` (number) | PIN zaroori |

Comma bhi chalega: `DEVICE_ID,1234,naam`

Sample: `assets/notes/devices.example.txt`

## Flow

1. App kholo → **Meri Device ID** dikhegi → **Copy ID**
2. PC/Notes mein `devices.txt` banao, apni ID lines mein dalo
3. App → **Device txt load** → file choose
4. Tumhari ID list mein:
   - **OPEN** → turant access
   - **PIN** → PIN daalo → verify
   - nahi mili → denied

## Filter

- **Sab** — poori list
- **Bina PIN** — sirf open devices
- **PIN wale** — sirf PIN devices

## APK banao

`APK-BANAO.md` — `npx eas-cli build -p android --profile preview`

**Note:** PIN sirf app mein check hota hai — strong security ke liye baad mein server chahiye.
