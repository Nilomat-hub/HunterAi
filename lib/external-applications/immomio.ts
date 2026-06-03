import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { Application, Listing, PortalAccount } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto/secrets";

type ImmomioPreparationInput = {
  application: Application & { listing: Listing };
  account?: PortalAccount | null;
};

export type ImmomioPreparationResult = {
  status: "LOGIN_REQUIRED" | "READY_FOR_MANUAL_REVIEW" | "FAILED";
  note: string;
  url?: string;
  fields?: Array<{
    label: string;
    type?: string | null;
    required: boolean;
  }>;
};

export async function prepareImmomioApplication({ application, account }: ImmomioPreparationInput) {
  const applicationUrl = application.listing.applicationUrl;
  if (!applicationUrl) {
    return {
      status: "FAILED",
      note: "Für dieses Inserat ist kein externer Bewerbungslink gespeichert."
    } satisfies ImmomioPreparationResult;
  }

  let browser: Awaited<ReturnType<typeof launchChromium>> | undefined;
  let page: Page | undefined;
  try {
    browser = await launchChromium("Immomio-Vorbereitung");
    page = await browser.newPage({ viewport: { width: 1365, height: 1200 } });
    await page.goto(applicationUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
    await page.getByRole("button", { name: "Alle erlauben" }).click({ timeout: 5000 }).catch(() => undefined);

    if (account) {
      await clickApply(page);
      await clickLogin(page);
      const loginResult = await tryLogin(page, account);
      if (!loginResult) {
        return {
          status: "LOGIN_REQUIRED",
          note: "Immomio-Login konnte noch nicht automatisch abgeschlossen werden. Bitte Zugangsdaten prüfen oder Login-Flow erweitern.",
          url: page.url(),
          fields: await visibleFields(page)
        };
      }

    } else {
      await clickApply(page);
      await clickLogin(page);
      return {
        status: "LOGIN_REQUIRED",
        note: "Immomio-Konto ist noch nicht in Portal-Konten gespeichert.",
        url: page.url(),
        fields: await visibleFields(page)
      };
    }

    return {
      status: "READY_FOR_MANUAL_REVIEW",
      note: "Immomio wurde geöffnet und der Login wurde abgeschlossen. Die Bewerbung wurde noch nicht abgeschickt.",
      url: page.url(),
      fields: await visibleFields(page)
    };
  } catch (error) {
    return {
      status: "FAILED",
      note: error instanceof Error ? error.message : "Immomio-Vorbereitung fehlgeschlagen.",
      url: page?.url()
    };
  } finally {
    await browser?.close();
  }
}

async function clickApply(page: Page) {
  const apply = page.getByRole("button", { name: "Jetzt bewerben" });
  if ((await apply.count()) > 0) {
    await apply.click({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
}

async function clickLogin(page: Page) {
  const login = page.getByText("Bereits registriert?", { exact: false });
  if ((await login.count()) > 0) {
    await login.click({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
}

async function tryLogin(page: Page, account: PortalAccount) {
  const username = decryptSecret(account.usernameEncrypted);
  const password = decryptSecret(account.passwordEncrypted);

  const emailInputs = page.locator('input[type="email"], input[placeholder*="mail" i], input[placeholder*="E-Mail" i]');
  const passwordInputs = page.locator('input[type="password"]');

  if ((await emailInputs.count()) < 1 || (await passwordInputs.count()) < 1) {
    return false;
  }

  await emailInputs.first().fill(username, { timeout: 5000 });
  await passwordInputs.first().fill(password, { timeout: 5000 });

  const submit = page.getByRole("button", { name: "Anmelden" });
  if ((await submit.count()) < 1) return false;

  await submit.click({ timeout: 10000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  return !/passwort|ungültig|fehler|anmelden/i.test(bodyText) || /persönliche angaben|kontaktdaten|haushalt/i.test(bodyText);
}

async function visibleFields(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("input, textarea, select"))
      .map((element) => {
        const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        return {
          label: input.getAttribute("placeholder") || input.getAttribute("aria-label") || input.id || input.name || input.tagName,
          type: input.getAttribute("type"),
          required: input.hasAttribute("required")
        };
      })
      .slice(0, 50)
  );
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
