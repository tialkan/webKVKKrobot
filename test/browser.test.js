import test from "node:test";
import assert from "node:assert/strict";
import { browserScan } from "../src/browser.js";
const html = `<!doctype html><html><body><button onclick="document.cookie='essential=one';localStorage.setItem('choice','reject')">Reddet</button><button onclick="document.cookie='tracking=secret';localStorage.setItem('choice','accept');const i=new Image();i.src='https://tracker.example/pixel'">Kabul et</button></body></html>`;
test(
  "real Chromium distinguishes fresh visit/reject/accept without retaining values",
  { skip: process.env.ROBOT_BROWSER_TEST !== "1" },
  async () => {
    const snapshots = await browserScan("https://8.8.8.8", {
      fetcher: async (url) => {
        const body = url.includes("tracker.example") ? "" : html;
        return {
          status: 200,
          headers: { "content-type": "text/html" },
          buffer: Buffer.from(body),
          bytes: Buffer.byteLength(body),
          cookiesRaw: [],
        };
      },
    });
    assert.equal(snapshots[0].cookies.length, 0);
    assert.equal(snapshots[1].clicked, true);
    assert.equal(snapshots[1].cookies[0].name, "essential");
    assert.equal(snapshots[2].clicked, true);
    assert.equal(snapshots[2].cookies[0].name, "tracking");
    assert.ok(
      snapshots[2].requests.some((r) => r.url.includes("tracker.example")),
    );
    assert.ok(!JSON.stringify(snapshots).includes('"value"'));
  },
);
