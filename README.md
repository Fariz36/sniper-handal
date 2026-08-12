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

`reference.js` is only a login/profile setup tool. It never clicks `Batal Kirim`, `Ambil`, `Hapus`, or `Kirim`.

## Configure your own account

**Do not copy another person's URLs.** SIX URLs identify both the student context and the study-plan record. Before running either watcher, replace every account-specific URL with one copied from your own logged-in SIX browser session.

1. Open your own Rencana Studi page in SIX and copy its URL into `PLAN_URL`.
2. Open each target class through your own SIX session and copy its URL into the target's `url`.
3. Do this separately in both `course-war.js` and `course-war-optimistic.js` if you plan to use both.

For example, these URL parts are personal and must belong to the person running the script:

```text
/app/mahasiswa:<your-context>+<semester>/registrasi/rencanastudi/<your-student-id>
/app/mahasiswa:<your-context>+<semester>/registrasI/mk/<your-student-id>/kelas/<class-id>
```

The values shown in this repository are examples for one account only. Leaving another person's `mahasiswa:...` context or student ID in place can cause SIX to show an unexpected page and the script to fail.

## Configure a target

Edit `TARGETS` at the top of `course-war.js`. Each target needs a target URL copied from your own session, its course code, and the expected SIX success text:

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

## Experimental optimistic mode

`course-war-optimistic.js` is a separate, intentionally unreliable variant. It dispatches `Batal Kirim` and `Ambil` together without waiting for SIX to confirm either action, then dispatches `Kirim` as soon as SIX renders the button. Use it only if you accept that SIX may reject `Ambil`, submit the old KRS, or leave a result requiring manual review.

```bash
node course-war-optimistic.js
```
