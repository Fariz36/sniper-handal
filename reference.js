const { chromium } = require("playwright");

const RETRY_INTERVAL = 5000;

// Profile ini menyimpan session/login browser kamu
const PROFILE_DIR = "./six-profile";

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
  });

  let pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Buka SIX
  await page.goto("https://six.itb.ac.id", {
    waitUntil: "domcontentloaded",
  });

  console.log("");
  console.log("==========================================");
  console.log(" SIX KRS AUTO RETRY");
  console.log("==========================================");
  console.log("");
  console.log("1. Login ke SIX secara manual.");
  console.log("2. Buka halaman Rencana Studi.");
  console.log("3. Pastikan mata kuliah yang mau diambil sudah dipilih.");
  console.log("4. Setelah siap, kembali ke terminal.");
  console.log("");

  await waitForEnter();

  console.log("");
  console.log("🚀 Mulai auto-submit...");
  console.log(`⏱️  Interval retry: ${RETRY_INTERVAL / 1000} detik`);
  console.log("");

  while (true) {
    try {
      // Pastikan tombol Kirim masih ada
      const submitButton = page.locator("#form_save");

      await submitButton.waitFor({
        state: "visible",
        timeout: 10000,
      });

      console.log(
        `[${new Date().toLocaleTimeString()}] 📤 Mengirim KRS...`
      );

      // Klik tombol Kirim
      await submitButton.click();

      // Tunggu proses submit/navigation selesai
      await page.waitForLoadState("domcontentloaded").catch(() => {});

      // Beri waktu sedikit untuk flash message muncul
      await page.waitForTimeout(1000);

      // ==========================================
      // CEK ERROR "KELAS PENUH"
      // ==========================================

      const dangerAlert = page.locator(".alert.alert-danger");

      const hasDanger = await dangerAlert
        .isVisible()
        .catch(() => false);

      if (hasDanger) {
        const message = (
          await dangerAlert.innerText().catch(() => "")
        ).trim();

        console.log(`❌ SIX: ${message}`);

        if (/kelas penuh/i.test(message)) {
          console.log(
            `⏳ Kelas masih penuh. Retry dalam ${RETRY_INTERVAL / 1000} detik...`
          );

          await page.waitForTimeout(RETRY_INTERVAL);
          continue;
        }

        // Error lain jangan dianggap kelas penuh
        console.log("");
        console.log("⚠️ SIX memberikan error selain 'Kelas Penuh'.");
        console.log("Script dihentikan supaya tidak mengulang error.");
        console.log("");

        break;
      }

      // ==========================================
      // CEK SUCCESS ALERT
      // ==========================================

      const successAlert = page.locator(".alert.alert-success");

      const hasSuccess = await successAlert
        .isVisible()
        .catch(() => false);

      if (hasSuccess) {
        const message = (
          await successAlert.innerText().catch(() => "")
        ).trim();

        console.log("");
        console.log("==========================================");
        console.log("✅ KRS BERHASIL!");
        console.log("==========================================");
        console.log(message);
        console.log("");

        break;
      }

      // ==========================================
      // FALLBACK
      // ==========================================
      //
      // Jika SIX tidak menggunakan alert-success,
      // cek apakah masih ada error kelas penuh.
      //
      // Kalau sudah tidak ada error tersebut, kita
      // anggap submit berhasil dan berhenti.
      //

      const bodyText = await page.locator("body").innerText();

      if (!/kelas penuh/i.test(bodyText)) {
        console.log("");
        console.log("==========================================");
        console.log("✅ Tidak ada error 'Kelas Penuh'.");
        console.log("   Submit kemungkinan berhasil.");
        console.log("==========================================");
        console.log("");

        break;
      }

      // Kalau sampai sini masih kelas penuh
      console.log(
        `⏳ Masih penuh. Retry dalam ${RETRY_INTERVAL / 1000} detik...`
      );

      await page.waitForTimeout(RETRY_INTERVAL);
    } catch (error) {
      console.log("");
      console.log(`⚠️ Terjadi error: ${error.message}`);
      console.log(
        `⏳ Retry dalam ${RETRY_INTERVAL / 1000} detik...`
      );
      console.log("");

      await page.waitForTimeout(RETRY_INTERVAL);
    }
  }

  console.log("Browser tetap terbuka.");
})();

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolve();
    });
  });
}