import fs from "node:fs";
import { remote } from "webdriverio";
import { expect } from "chai";
import config from "../appium.config.js";
import cases, { mobileCases } from "../../scripts/scenarios.js";
import { Analyzer } from "../pages/Analyzer.js";
const appiumSmokeIds = new Set([
  "002",
  "273",
  "291",
  "305",
  "311",
  "318",
  "319",
  "320",
  "323",
  "326",
  "331",
  "332",
  "333",
  "335",
]);
export function suite(name, select) {
  describe(name, function () {
    let d, page;
    before(async () => {
      d = await remote(config);
      page = new Analyzer(d);
    });
    for (const c of cases
      .concat(mobileCases)
      .filter(
        (item) =>
          select(item) &&
          (process.env.APPIUM_FULL !== "0" ||
            appiumSmokeIds.has(item.id) ||
            mobileCases.some((mobileCase) => mobileCase.id === item.id)),
      ))
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
