# SIX course watcher

This script uses a local Playwright browser profile so you log in to SIX yourself. It does not need your password in the script.

## Install

Use Node.js 20 or newer, then run:

```bash
cd ~/fafo/sniper
npm install
npx playwright install chromium
```

If Chromium reports missing Linux packages:

```bash
npx playwright install-deps chromium
```

## Create the local SIX session

Run this once:

```bash
cd ~/fafo/sniper
node reference.js
```

When the Playwright Chromium window opens:

1. Log in to SIX manually.
2. Open the Rencana Studi page to confirm that you are logged in.
3. Close the browser normally.

Playwright will save the browser session in `six-profile/`. Future scripts reuse it automatically.

Treat `six-profile/` like a password: it can contain authenticated cookies. Do not commit, upload, copy, or share it. Each person must create their own local profile by logging in with their own account. Do not run two scripts simultaneously with the same profile.

## Configure a target

Edit `TARGETS` at the top of `course-war.js`. Each target needs the exact SIX class URL and its course code:

```js
const TARGETS = [
  {
    courseCode: "FI3132",
    label: "FI3132 / class 47112",
    url: "https://six.itb.ac.id/app/.../kelas/47112?fakultas=FMIPA&prodi=102#47112",
    addSuccessPattern: /FI3132 berhasil ditambahkan/i,
  },
];
```

If several targets are listed, the script selects the first one with a free seat, submits the KRS, and stops.

## Run

Before running, close any other Playwright/Chromium window using `six-profile/`.

```bash
cd ~/fafo/sniper
node course-war.js
```

The script opens one KRS tab and one tab per target. It polls availability, then executes `Batal Kirim → Ambil → Kirim` for the first available target. It reports timing for each action and stops after successful submission.

If an action fails after `Batal Kirim`, it attempts to submit the current plan again. Keep the browser open for manual review if it reports that the safety re-submit failed.

