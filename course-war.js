const { chromium } = require("playwright");

const PROFILE_DIR = "./six-profile";
const RETRY_INTERVAL_MS = 1500;

const PLAN_URL =
  "https://six.itb.ac.id/app/mahasiswa:13523069+2026-1/registrasi/rencanastudi/2021049003";
const TARGETS = [
  {
    courseCode: "FI3132",
    label: "FI3132 / class 47112",
    url: "https://six.itb.ac.id/app/mahasiswa:13523069+2026-1/registrasI/mk/2021049003/kelas/47112?fakultas=FMIPA&prodi=102#47112",
    addSuccessPattern: /FI3132 berhasil ditambahkan/i,
  }
];

let context;
let planPage;
let editablePlan = false;

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
  console.log(" SIX COURSE WAR — FI3132");
  console.log("==========================================\n");
  console.log(`This will poll every ${RETRY_INTERVAL_MS / 1000} seconds. The first available target wins:`);
  console.log("Batal Kirim → Ambil → Kirim.\n");
  console.log("Starting seat watch now.\n");

  while (true) {
    const pollStartedAt = Date.now();
    const target = await getFirstAvailableTarget();
    const now = new Date().toLocaleTimeString("id-ID");

    if (!target) {
      console.log(
        `[${now}] Both classes are full. Retrying in ${RETRY_INTERVAL_MS / 1000}s...`,
      );
      const remainingWaitMs = Math.max(0, RETRY_INTERVAL_MS - (Date.now() - pollStartedAt));
      await planPage.waitForTimeout(remainingWaitMs);
      continue;
    }

    console.log(
      `[${now}] ${target.label} seat found (${target.available} available). Starting registration...`,
    );
    await registerTarget(target);
    console.log(`\n✅ ${target.label} was added and the KRS was submitted successfully.`);
    break;
  }

  await context.close();
})().catch(async (error) => {
  console.error(`\n❌ ${error.message}`);

  if (editablePlan) {
    try {
      await resubmitCurrentPlan();
      console.log("✅ Safety re-submit completed.");
    } catch (resubmitError) {
      console.error(`❌ Safety re-submit failed: ${resubmitError.message}`);
    }
  }

  console.log("Browser remains open for manual review. Press Enter to close it.");
  await waitForEnter();
  await context?.close();
  process.exitCode = 1;
});

async function getFirstAvailableTarget() {
  const capacities = await Promise.all(TARGETS.map(async (target) => {
    await target.page.reload({ waitUntil: "domcontentloaded" });

    const capacity = await target.page.locator(".list-group-item.notice").evaluate((element) => {
      const text = element.innerText;
      const quota = Number((text.match(/Kuota\s*(\d+)/i) || [])[1]);
      const applicants = Number((text.match(/Pendaftar\s*(\d+)/i) || [])[1]);
      const buttonId = element.querySelector('button[type="submit"]')?.id;

      return { quota, applicants, available: quota - applicants, buttonId };
    });

    if (!Number.isFinite(capacity.available) || !capacity.buttonId) {
      throw new Error(`Could not read ${target.courseCode} capacity or its Ambil button.`);
    }

    return { ...target, ...capacity };
  }));

  return capacities.find((target) => target.available > 0) || null;
}

async function registerTarget(target) {
  const startedAt = Date.now();
  const krsForm = getKrsForm(planPage);

  if (await krsForm.locator("#form_withdraw").isVisible().catch(() => false)) {
    await submitAndWait(planPage, krsForm.locator("#form_withdraw"));
    editablePlan = true;
    await expectAlert(planPage, /rencana studi berhasil dibatalkan/i, "Batal Kirim");
    logStep("Batal Kirim", startedAt);
  } else if (await krsForm.getByRole("button", { name: /^Kirim$/i }).isVisible().catch(() => false)) {
    editablePlan = true;
  } else {
    throw new Error("Could not determine the KRS submission state.");
  }

  const addButton = target.page.locator(`button[id="${target.buttonId}"]`);
  await addButton.waitFor({ state: "visible", timeout: 10000 });
  await submitAndWait(target.page, addButton);
  await expectAlert(target.page, target.addSuccessPattern, "Ambil");
  logStep("Ambil", startedAt);

  const submitButton = getKrsForm(planPage).getByRole("button", { name: /^Kirim$/i });
  await submitButton.waitFor({ state: "visible", timeout: 10000 });
  await submitAndWait(planPage, submitButton);
  await expectAlert(planPage, /rencana studi berhasil disimpan/i, "Kirim");
  editablePlan = false;
  logStep("Kirim", startedAt);
}

function getKrsForm(currentPage) {
  return currentPage.locator('form[action*="/registrasi/rencanastudi/aD/2021049003"]');
}

async function submitAndWait(currentPage, button) {
  await Promise.all([
    currentPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }),
    button.click(),
  ]);
}

async function expectAlert(currentPage, pattern, action) {
  const messages = await currentPage.locator(".alert").allInnerTexts();
  if (!messages.some((message) => pattern.test(message))) {
    throw new Error(`${action} was not confirmed by SIX: ${messages.join(" | ") || "no alert returned"}`);
  }
}

async function resubmitCurrentPlan() {
  const submitButton = getKrsForm(planPage).getByRole("button", { name: /^Kirim$/i });

  if (!(await submitButton.isVisible().catch(() => false))) {
    return;
  }

  await submitAndWait(planPage, submitButton);
  await expectAlert(planPage, /rencana studi berhasil disimpan/i, "Safety re-submit");
}

function logStep(action, startedAt) {
  console.log(`[${new Date().toLocaleTimeString("id-ID")}] ${action} confirmed (+${Date.now() - startedAt} ms).`);
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });
}
