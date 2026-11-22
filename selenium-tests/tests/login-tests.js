import fs from "node:fs";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { expect } from "chai";
import cases from "../../scripts/scenarios.js";
import { Analyzer } from "../pages/Analyzer.js";
describe("GeneScan web", function () {
  let driver, page;
  before(async function () {
    const options = new chrome.Options().addArguments(
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1300,900",
    );
    if (process.env.CHROME_BIN)
      options.setChromeBinaryPath(process.env.CHROME_BIN);
    const builder = new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options);
    if (process.env.CHROMEDRIVER)
      builder.setChromeService(
        new chrome.ServiceBuilder(process.env.CHROMEDRIVER),
      );
    driver = await builder.build();
    page = new Analyzer(driver);
    await driver.get(process.env.WEB_URL || "http://localhost:5173");
    await driver.wait(
      () =>
        driver
          .findElements(page.labelled("DNA sequence"))
          .then((x) => x.length),
      15000,
    );
  });
  for (const c of cases)
    it("WEB-" + c.id + " " + c.title, async function () {
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
    if (t.state === "failed" && driver) {
      fs.mkdirSync("selenium-tests/screenshots", { recursive: true });
      fs.writeFileSync(
        "selenium-tests/screenshots/" + t.title.slice(0, 7) + ".png",
        await driver.takeScreenshot(),
        "base64",
      );
    }
    fs.appendFileSync(
      "selenium-tests/results.ndjson",
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
    await driver?.quit();
  });
});
