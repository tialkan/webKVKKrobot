import test from "node:test";
import assert from "node:assert/strict";
const response = (
  body = "<html><body>Test</body></html>",
  status = 200,
  url = "https://example.com/",
  headers = {},
) => ({
  ok: true,
  result: {
    url,
    status,
    headers: { "content-type": "text/html", ...headers },
    body,
    bytes: Buffer.byteLength(body),
    cookies: [],
    chain: [{ url, status }],
  },
});
import { auditSite, staticPrivacy } from "../src/audit.js";
test("form without cookies can still need notice review", () => {
  const r = staticPrivacy(
    '<form><input name="email"></form>',
    "https://example.com",
  );
  assert.ok(r.findings.some((f) => f.kod === "KVKK-FORM"));
});
test("unrecognised consent is not a completed reject/accept comparison", async () => {
  const r = await auditSite("example.com", {
    fetcher: async () => response(),
    browserScanner: async () =>
      ["ilk ziyaret", "reddet", "kabul et"].map((choice) => ({
        choice,
        clicked: false,
        cookies: [],
        storage: { local: [], session: [] },
        requests: [],
        blocked: 0,
      })),
  });
  assert.equal(
    r.bolumler.some((s) => s.baslik === "Tercih karşılaştırması"),
    false,
  );
  assert.match(r.bolumler[2].satirlar[0].deger, /doğrulanamadı/);
});
