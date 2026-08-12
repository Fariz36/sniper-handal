const { chromium } = require("playwright");

const PROFILE_DIR = "./six-profile";
const RETRY_INTERVAL_MS = 1500;
const PIPELINE_DELAY_MS = 0;
const PLAN_URL =
  "https://six.itb.ac.id/app/mahasiswa:13523069+2026-1/registrasi/rencanastudi/2021049003";
const STUDENT_ID = new URL(PLAN_URL).pathname.split("/").at(-1);
const KRS_FORM_ACTION_PART = `/registrasi/rencanastudi/aD/${STUDENT_ID}`;
const TARGETS = [
  {
    courseCode: "FI3132",
    label: "FI3132 / class 47112",
    url: "https://six.itb.ac.id/app/mahasiswa:13523069+2026-1/registrasI/mk/2021049003/kelas/47112?fakultas=FMIPA&prodi=102#47112",
    addSuccessPattern: /FI3132 berhasil ditambahkan/i,
  },
];

let context;
let planPage;

(async () => {
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
  });
  planPage = context.pages()[0] || (await context.newPage());
  for (const target of TARGETS) {
    target.page = await context.newPage();
  }

  await Promise.all([
    planPage.goto(PLAN_URL, { waitUntil: "domcontentloaded" }),
    ...TARGETS.map((target) => target.page.goto(target.url, { waitUntil: "domcontentloaded" })),
  ]);

  console.log("\n==========================================");
  console.log(" SIX COURSE WAR — OPTIMISTIC MODE");
  console.log("==========================================");
  console.log("This may submit the old plan or fail, depending on SIX timing.\n");

  while (true) {
    const pollStartedAt = Date.now();
    const target = await getFirstAvailableTarget();

    if (!target) {
      console.log(
        `[${new Date().toLocaleTimeString("id-ID")}] All targets are full.`,
      );
      await planPage.waitForTimeout(
        Math.max(0, RETRY_INTERVAL_MS - (Date.now() - pollStartedAt)),
      );
      continue;
    }

    console.log(
      `[${new Date().toLocaleTimeString("id-ID")}] ${target.label} seat found. Firing optimistic pipeline...`,
    );
    await firePipeline(target);
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

async function getFirstAvailableTarget() {
  const capacities = await Promise.all(TARGETS.map(async (target) => {
    const response = await target.page.request.get(target.url, {
      headers: { "cache-control": "no-cache" },
    });

    if (!response.ok()) {
      throw new Error(`Could not poll ${target.courseCode}: SIX returned HTTP ${response.status()}.`);
    }

    const html = await response.text();
    const quota = Number((html.match(/Kuota\s*<strong>\s*(\d+)/i) || [])[1]);
    const applicants = Number((html.match(/Pendaftar\s*<strong>\s*(\d+)/i) || [])[1]);
    const buttonId = (html.match(/id="(form_add:[^"]+)"/i) || [])[1];
    const capacity = { quota, applicants, available: quota - applicants, buttonId };

    if (!Number.isFinite(capacity.available) || !capacity.buttonId) {
      throw new Error(`Could not read ${target.courseCode} capacity or Ambil button.`);
    }

    return { ...target, ...capacity };
  }));

  return capacities.find((target) => target.available > 0) || null;
}

async function firePipeline(target) {
  const startedAt = Date.now();
  const krsForm = getKrsForm();
  const withdrawButton = krsForm.locator("#form_withdraw");
  const addButton = target.page.locator(`button[id="${target.buttonId}"]`);

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
