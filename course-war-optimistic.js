const { chromium } = require("playwright");

const PROFILE_DIR = "./six-profile";
const RETRY_INTERVAL_MS = 1500;
const PIPELINE_DELAY_MS = 100;
const PLAN_URL =
  "https://six.itb.ac.id/app/mahasiswa:13523069+2026-1/registrasi/rencanastudi/2021049003";
const STUDENT_ID = new URL(PLAN_URL).pathname.split("/").at(-1);
const KRS_FORM_ACTION_PART = `/registrasi/rencanastudi/aD/${STUDENT_ID}`;
const TARGET = {
  label: "FI3132 / class 47112",
  url: "https://six.itb.ac.id/app/mahasiswa:13523069+2026-1/registrasI/mk/2021049003/kelas/47112?fakultas=FMIPA&prodi=102#47112",
};

let context;
let planPage;
let targetPage;

(async () => {
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
  });
  planPage = context.pages()[0] || (await context.newPage());
  targetPage = await context.newPage();

  await Promise.all([
    planPage.goto(PLAN_URL, { waitUntil: "domcontentloaded" }),
    targetPage.goto(TARGET.url, { waitUntil: "domcontentloaded" }),
  ]);

  console.log("\n==========================================");
  console.log(" SIX COURSE WAR — OPTIMISTIC MODE");
  console.log("==========================================");
  console.log("Uses 100 ms gaps between Batal Kirim, Ambil, and Kirim.");
  console.log("This may submit the old plan or fail, depending on SIX timing.\n");

  while (true) {
    const pollStartedAt = Date.now();
    const capacity = await getCapacity();

    if (capacity.available < 1) {
      console.log(
        `[${new Date().toLocaleTimeString("id-ID")}] Full (${capacity.applicants}/${capacity.quota}).`,
      );
      await planPage.waitForTimeout(
        Math.max(0, RETRY_INTERVAL_MS - (Date.now() - pollStartedAt)),
      );
      continue;
    }

    console.log(
      `[${new Date().toLocaleTimeString("id-ID")}] ${TARGET.label} seat found. Firing optimistic pipeline...`,
    );
    await firePipeline(capacity.buttonId);
    console.log("Pipeline sent. Check SIX manually to confirm the final KRS state.");
    break;
  }
})().catch(async (error) => {
  console.error(`\n❌ ${error.message}`);
  console.log("Browser remains open for manual review. Press Enter to close it.");
  await waitForEnter();
  await context?.close();
  process.exitCode = 1;
});

async function getCapacity() {
  await targetPage.reload({ waitUntil: "domcontentloaded" });
  const capacity = await targetPage.locator(".list-group-item.notice").evaluate((element) => {
    const text = element.innerText;
    const quota = Number((text.match(/Kuota\s*(\d+)/i) || [])[1]);
    const applicants = Number((text.match(/Pendaftar\s*(\d+)/i) || [])[1]);
    const buttonId = element.querySelector('button[type="submit"]')?.id;
    return { quota, applicants, available: quota - applicants, buttonId };
  });

  if (!Number.isFinite(capacity.available) || !capacity.buttonId) {
    throw new Error("Could not read target capacity or Ambil button.");
  }

  return capacity;
}

async function firePipeline(buttonId) {
  const startedAt = Date.now();
  const krsForm = getKrsForm();
  const withdrawButton = krsForm.locator("#form_withdraw");
  const addButton = targetPage.locator(`button[id="${buttonId}"]`);

  if (!(await withdrawButton.isVisible().catch(() => false))) {
    throw new Error("Batal Kirim is not visible; the KRS must start in submitted state.");
  }

  await addButton.waitFor({ state: "visible", timeout: 10000 });

  // Intentionally do not wait for SIX to confirm Batal Kirim before sending Ambil.
  await withdrawButton.click({ noWaitAfter: true });
  await planPage.waitForTimeout(PIPELINE_DELAY_MS);
  await addButton.click({ noWaitAfter: true });
  console.log(`[${new Date().toLocaleTimeString("id-ID")}] Batal Kirim + Ambil dispatched (+${Date.now() - startedAt} ms).`);

  // Kirim cannot be dispatched until SIX renders it after the withdrawal navigation.
  await planPage.waitForTimeout(PIPELINE_DELAY_MS);
  const submitButton = getKrsForm().getByRole("button", { name: /^Kirim$/i });
  await submitButton.waitFor({ state: "visible", timeout: 15000 });
  await submitButton.click({ noWaitAfter: true });
  console.log(`[${new Date().toLocaleTimeString("id-ID")}] Kirim dispatched (+${Date.now() - startedAt} ms).`);
}

function getKrsForm() {
  return planPage.locator(`form[action*="${KRS_FORM_ACTION_PART}"]`);
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });
}
