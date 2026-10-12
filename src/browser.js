import { chromium } from "playwright";
import { safeFetch } from "./net.js";
import { normalizeTarget } from "./security.js";
export async function browserScan(input, options = {}) {
  const target = normalizeTarget(input);
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.KVKK_BROWSER_EXECUTABLE_PATH
      ? { executablePath: process.env.KVKK_BROWSER_EXECUTABLE_PATH }
      : {}),
  });
  const signal = options.signal ?? AbortSignal.timeout(35000);
  let requests = 0,
    totalBytes = 0;
  const observations = [];
  try {
    for (const choice of ["ilk ziyaret", "reddet", "kabul et"]) {
      signal.throwIfAborted();
      const context = await browser.newContext({
        serviceWorkers: "block",
        ignoreHTTPSErrors: false,
      });
      const seen = [];
      let clicked = false;
      let failed = "";
      let blocked = 0;
      await context.routeWebSocket(/.*/, (socket) => socket.close());
      await context.route("**/*", async (route) => {
        const req = route.request();
        const url = req.url();
        requests++;
        if (requests > 120 || signal.aborted) {
          blocked++;
          await route.abort().catch(() => {});
          return;
        }
        seen.push({
          url: url.split("?")[0].slice(0, 2048),
          method: req.method(),
          type: req.resourceType(),
        });
        if (
          !["GET", "HEAD"].includes(req.method()) ||
          totalBytes > 15000000 ||
          signal.aborted
        ) {
          blocked++;
          await route.abort().catch(() => {});
          return;
        }
        try {
          const result = await (options.fetcher ?? safeFetch)(url, {
            signal,
            timeout: 5000,
            maxBytes: 3000000,
            method: req.method(),
            followRedirects: false,
            headers: { cookie: req.headers().cookie ?? "" },
          });
          totalBytes += result.bytes;
          const headers = { ...result.headers };
          delete headers["content-encoding"];
          delete headers["content-length"];
          delete headers["transfer-encoding"];
          if (result.cookiesRaw?.length)
            headers["set-cookie"] = result.cookiesRaw.join("\n");
          await route.fulfill({
            status: result.status,
            headers,
            body: result.buffer,
          });
        } catch {
          blocked++;
          await route.abort().catch(() => {});
        }
      });
      const page = await context.newPage();
      try {
        await page.goto(target.href, {
          waitUntil: "domcontentloaded",
          timeout: 9000,
        });
        await page.waitForTimeout(800);
        if (choice !== "ilk ziyaret") {
          const re =
            choice === "reddet"
              ? /^(?:tümünü reddet|hepsini reddet|reddet|reject all|reject|decline|yalnızca gerekli çerezler)$/i
              : /^(?:tümünü kabul et|hepsini kabul et|kabul et|accept all|accept|allow all)$/i;
          const buttons = page.getByRole("button", { name: re });
          if ((await buttons.count()) === 1 && (await buttons.isVisible())) {
            await buttons.click({ timeout: 2000 });
            clicked = true;
            await page.waitForTimeout(1000);
          }
        }
        const cookies = (await context.cookies()).map((c) => ({
          name: c.name,
          domain: c.domain,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite,
        }));
        const storage = await page
          .evaluate(() => ({
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage),
          }))
          .catch(() => ({ local: [], session: [] }));
        observations.push({
          choice,
          clicked,
          cookies,
          storage,
          requests: seen,
          blocked,
          finalUrl: page.url(),
        });
      } catch {
        failed = "Sayfa yüklemesi veya etkileşim tamamlanamadı.";
        observations.push({
          choice,
          clicked,
          error: failed,
          cookies: [],
          storage: { local: [], session: [] },
          requests: seen,
          blocked,
        });
      } finally {
        await context.close();
      }
    }
    return observations;
  } finally {
    await browser.close();
  }
}
