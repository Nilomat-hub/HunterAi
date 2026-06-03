import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { Application, Listing, User } from "@prisma/client";
import { validateDirectImmobilie1SendInput } from "@/lib/actions/application-safety";

type Immobilie1ContactInput = {
  application: Application & { listing: Listing };
  user: User;
};

export type Immobilie1ContactResult = {
  status: "SUBMITTED" | "FAILED";
  note: string;
  url?: string;
};

export async function submitImmobilie1ContactApplication({ application, user }: Immobilie1ContactInput) {
  const message = application.editedMessage ?? application.message;
  const validation = validateDirectImmobilie1SendInput({
    firstName: user.firstName,
    lastName: user.lastName,
    contactEmail: user.contactEmail,
    loginEmail: user.email,
    salutation: user.salutation,
    message
  });
  if (!validation.ok) {
    return {
      status: "FAILED",
      note: validation.reasons.join(" ")
    } satisfies Immobilie1ContactResult;
  }

  let browser: Awaited<ReturnType<typeof launchChromium>> | undefined;
  let page: Page | undefined;
  try {
    browser = await launchChromium("Immobilie1-Kontaktformular");
    page = await browser.newPage({ viewport: { width: 1365, height: 1200 } });
    await page.goto(application.listing.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
    await acceptCookies(page);
    await clickContact(page);
    await fillContactForm(page, validation.values, user.phone);
    await page.getByRole("button", { name: /^anfrage senden$/i }).click({ timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    if (/erfolgreich|gesendet|vielen dank|anfrage wurde/i.test(bodyText)) {
      return {
        status: "SUBMITTED",
        note: "Immobilie1-Anfrage wurde über das Kontaktformular abgeschickt.",
        url: page.url()
      } satisfies Immobilie1ContactResult;
    }

    return {
      status: "FAILED",
      note: "Immobilie1-Formular wurde ausgefüllt, aber es gab keine eindeutige Versandbestätigung.",
      url: page.url()
    } satisfies Immobilie1ContactResult;
  } catch (error) {
    return {
      status: "FAILED",
      note: error instanceof Error ? error.message : "Immobilie1-Kontaktformular konnte nicht abgeschickt werden.",
      url: page?.url()
    } satisfies Immobilie1ContactResult;
  } finally {
    await browser?.close();
  }
}

async function acceptCookies(page: Page) {
  await page
    .getByRole("button", { name: /alle zulassen|alle akzeptieren|akzeptieren|zustimmen/i })
    .click({ timeout: 5000 })
    .catch(() => undefined);
}

async function clickContact(page: Page) {
  const contact = page.getByRole("button", { name: /^anbieter kontaktieren$/i });
  if ((await contact.count()) > 0) {
    await contact.first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    return;
  }

  await page.locator("#exposeContact").scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
  await page.getByRole("button", { name: /^anbieter kontaktieren$/i }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1000);
}

async function fillContactForm(
  page: Page,
  values: {
    fullName: string;
    contactEmail: string;
    salutation: string;
    message: string;
  },
  phone?: string | null
) {
  await chooseSalutation(page, values.salutation);
  await page.locator("#contact_name").fill(values.fullName, { timeout: 5000 });
  await page.locator("#contact_email").fill(values.contactEmail, { timeout: 5000 });
  if (phone) {
    await page.locator("#contact_phone").fill(phone, { timeout: 5000 }).catch(() => undefined);
  }
  await page.locator("#contact_message").fill(values.message, { timeout: 5000 });
}

async function chooseSalutation(page: Page, salutation: string) {
  const current = await page.locator("#salutation").inputValue().catch(() => "");
  if (current) return;

  await page.getByRole("button", { name: /^anrede$/i }).click({ timeout: 5000 }).catch(() => undefined);
  const escapedSalutation = salutation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const options = [
    page.getByRole("option", { name: new RegExp(`^${escapedSalutation}$`, "i") }),
    page.getByText(new RegExp(`^${escapedSalutation}$`, "i")),
    page.getByRole("option", { name: /^herr$/i }),
    page.getByRole("option").first()
  ];

  for (const option of options) {
    if ((await option.count().catch(() => 0)) > 0) {
      await option.first().click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      return;
    }
  }
}

function getLocalChromiumPath() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured && fs.existsSync(configured)) return configured;

  const local = path.join(process.cwd(), ".playwright-runtime", "chromium-1223", "chrome-win64", "chrome.exe");
  if (fs.existsSync(local)) return local;

  return undefined;
}

async function launchChromium(context: string) {
  try {
    return await chromium.launch({
      headless: true,
      executablePath: getLocalChromiumPath()
    });
  } catch {
    throw new Error(
      `${context}: Chromium konnte nicht gestartet werden. Chromium availability on Vercel is not guaranteed; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or install Playwright Chromium for this runtime.`
    );
  }
}
