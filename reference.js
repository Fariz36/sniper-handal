const { chromium } = require("playwright");

const PROFILE_DIR = "./six-profile";

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto("https://six.itb.ac.id", { waitUntil: "domcontentloaded" });

  console.log("\n==========================================");
  console.log(" SIX LOGIN / PROFILE SETUP");
  console.log("==========================================\n");
  console.log("1. Log in to SIX manually in the opened browser.");
  console.log("2. Confirm you can open your own Rencana Studi page.");
  console.log("3. Close the browser normally when finished.\n");
  console.log("This script does not click Batal Kirim, Ambil, Kirim, or any KRS control.");

  await new Promise((resolve) => context.once("close", resolve));
})();
