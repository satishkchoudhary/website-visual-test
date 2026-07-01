import type { Page } from "playwright";
import type { VisualConfig } from "../types.js";

export async function openStablePage(page: Page, url: string, config: VisualConfig): Promise<void> {
  await page.goto(url, {
    waitUntil: config.waitUntil,
    timeout: config.timeoutMs,
  });

  if (config.waitForSelector) {
    await page.waitForSelector(config.waitForSelector, { timeout: config.timeoutMs });
  }

  await disableAnimationsAndHideElements(page, config);
  await handleCookieBanner(page, config);
}

export async function screenshotMaskLocators(page: Page, config: VisualConfig) {
  return config.maskSelectors.map((selector) => page.locator(selector));
}

async function disableAnimationsAndHideElements(page: Page, config: VisualConfig): Promise<void> {
  const hideBlock = config.hideSelectors.length
    ? `${config.hideSelectors.join(",\n")} { visibility: hidden !important; }`
    : "";

  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-delay: 0s !important;
        animation-duration: 0.001s !important;
        animation-iteration-count: 1 !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }

      ${hideBlock}
    `,
  }).catch(() => undefined);
}

async function handleCookieBanner(page: Page, config: VisualConfig): Promise<void> {
  const selectors = [
    ...config.cookieBanner.acceptSelectors,
    ...config.cookieBanner.dismissSelectors,
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;
    await locator.click({ timeout: 1000 }).catch(() => undefined);
    return;
  }
}
