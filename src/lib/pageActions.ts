import type { Frame, Page } from "playwright";
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
  await waitForImages(page, config);
  const clickedLateBanner = await handleCookieBanner(page, config);
  if (clickedLateBanner) await waitForImages(page, config);
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

async function handleCookieBanner(page: Page, config: VisualConfig): Promise<boolean> {
  const selectors = [
    ...config.cookieBanner.acceptSelectors,
    ...config.cookieBanner.dismissSelectors,
  ];
  const timeoutMs = Math.max(0, config.cookieBanner.timeoutMs ?? 0);
  if (timeoutMs === 0 || selectors.length === 0) return false;
  const deadline = Date.now() + timeoutMs;

  do {
    if (await clickCookieControl(page, selectors)) return true;

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      if (await clickCookieControl(frame, selectors)) return true;
    }

    await page.waitForTimeout(250).catch(() => undefined);
  } while (Date.now() < deadline);

  return false;
}

async function clickCookieControl(target: Page | Frame, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = target.locator(selector).first();
    const visible = await locator.isVisible({ timeout: 200 }).catch(() => false);
    if (!visible) continue;
    const clicked = await locator.click({ timeout: 1500 }).then(() => true).catch(() => false);
    if (!clicked) continue;
    await target.waitForTimeout(300).catch(() => undefined);
    return true;
  }

  return false;
}

async function waitForImages(page: Page, config: VisualConfig): Promise<void> {
  if (!config.waitForImages) return;

  const timeoutMs = Math.max(0, Math.min(config.timeoutMs, config.imageReadyTimeoutMs));
  if (timeoutMs === 0) return;

  const hasIncompleteImages = await page.evaluate(() => {
    const images = Array.from(document.images);
    return images.some((image) => !image.complete);
  }).catch(() => false);
  if (!hasIncompleteImages) return;

  if (config.fullPage) await triggerLazyImages(page, timeoutMs);

  await page.waitForFunction(() => {
    const images = Array.from(document.images);
    return images.every((image) => image.complete);
  }, undefined, { timeout: timeoutMs }).catch(() => undefined);
}

async function triggerLazyImages(page: Page, timeoutMs: number): Promise<void> {
  const viewport = page.viewportSize();
  const viewportHeight = viewport?.height ?? 900;
  const maxSteps = 12;
  const scrollState = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    height: Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      window.innerHeight,
    ),
  })).catch(() => ({ x: 0, y: 0, height: viewportHeight }));

  const stepSize = Math.max(300, Math.floor(viewportHeight * 0.8));
  const steps = Math.min(maxSteps, Math.max(1, Math.ceil(scrollState.height / stepSize)));
  const pauseMs = Math.min(150, Math.max(50, Math.floor(timeoutMs / Math.max(steps, 1) / 4)));

  for (let index = 0; index <= steps; index += 1) {
    const y = Math.min(scrollState.height, index * stepSize);
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y).catch(() => undefined);
    await page.waitForTimeout(pauseMs).catch(() => undefined);
  }

  await page.evaluate(({ x, y }) => window.scrollTo(x, y), scrollState).catch(() => undefined);
}
