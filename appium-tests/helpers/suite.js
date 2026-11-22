import fs from "node:fs";
import { remote } from "webdriverio";
import { expect } from "chai";
import config from "../appium.config.js";
import { androidCases } from "../../scripts/android-cases.js";
import { Analyzer } from "../pages/Analyzer.js";
export function suite(name, select) {
  const selected = androidCases.filter(select);
  if (!selected.length) return;
  describe(name, function () {
    let d, page;
    before(async () => {
      d = await remote(config);
      page = new Analyzer(d);
    });
    for (const c of selected)
      it("MOB-" + c.id + " " + c.title, async function () {
        if (
          ["signup", "recover"].includes(c.action) &&
          process.env.TEST_LOCAL_MAIL !== "1"
        )
          this.skip();
        if (
          c.email === "fixture" &&
          !(
            process.env.TEST_GATEWAY_URL &&
            process.env.TEST_EMAIL &&
            process.env.TEST_PASSWORD
          )
        )
          this.skip();
        expect(await page.check(c)).to.equal(c.expected);
        if (c.action === "signup") await page.click("Sign out");
      });
    afterEach(async function () {
      const t = this.currentTest;
      if (t.state === "failed" && d) {
        fs.mkdirSync("appium-tests/screenshots", { recursive: true });
        await d.saveScreenshot(
          "appium-tests/screenshots/" + t.title.slice(0, 7) + ".png",
        );
      }
      fs.appendFileSync(
        "appium-tests/results.ndjson",
        JSON.stringify({
          id: t.title.slice(4, 7),
          status: t.state,
          time: t.duration,
          error: t.err?.message,
          date: new Date().toISOString(),
        }) + "\n",
      );
    });
    after(async () => {
      await d?.deleteSession();
    });
  });
}
