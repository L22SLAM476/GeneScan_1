import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { By, until } from "selenium-webdriver";
export class Analyzer {
  constructor(driver) {
    this.d = driver;
  }
  labelled(name) {
    return By.css('[aria-label="' + name + '"]');
  }
  async click(label) {
    await (
      await this.d.wait(until.elementLocated(this.labelled(label)), 5000)
    ).click();
  }
  async importFile(filename, contents) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "genescan-"));
    try {
      const file = path.join(dir, filename);
      await fs.writeFile(file, contents);
      await this.d.executeScript("document.querySelector('#sequence-file').click=()=>{}");
      await this.click("Import file");
      await this.d.findElement(By.id("sequence-file")).sendKeys(file);
      await this.d.wait(async () => {
        const field = await this.d.findElement(this.labelled("Sequence name"));
        const message = await this.d.findElements(By.css('[data-testid="message"]'));
        return (await field.getAttribute("value")) === filename || message.length > 0;
      }, 6000);
    } finally {
      await this.d.executeScript("delete document.querySelector('#sequence-file').click");
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
  async accountForm(c) {
    await this.click("Account");
    if (!["Sign in", "persist", "logout"].includes(c.mode))
      await this.click(c.mode);
    const fill = async (label, value) => {
      const el = await this.d.findElement(this.labelled(label));
      await el.clear();
      if (value) await el.sendKeys(value);
    };
    await fill(
      "Email",
      c.email === "fixture" ? process.env.TEST_EMAIL : c.email,
    );
    if (c.mode !== "Forgot password")
      await fill(
        "Password",
        c.password === "fixture" ? process.env.TEST_PASSWORD : c.password,
      );
    if (c.mode === "Register" && (c.password === "abc" || c.matchPassword))
      await fill("Confirm password", c.password);
    await this.click(
      ["persist", "logout"].includes(c.mode) ? "Sign in" : c.mode,
    );
    if (!["persist", "logout"].includes(c.mode))
      return this.d.wait(async () => {
        const els = await this.d.findElements(
          By.css('[data-testid="message"]'),
        );
        return els.length && (await els[0].getText());
      }, 8000);
    await this.d.wait(until.elementLocated(this.labelled("Sign out")), 8000);
    if (c.mode === "persist") {
      await this.click("Analyzer");
      await this.click("Clear");
      const name = "GeneScan QA browser " + Date.now();
      await this.importFile("genescan-qa.fasta", ">qa\nATGCNN");
      await fill("Sequence name", name);

      await this.click("Analyze");
      await this.click("Save analysis");
      await this.d.wait(until.elementLocated(this.labelled("Saved")), 8000);
      await this.d.navigate().refresh();
      await this.d.wait(until.elementLocated(this.labelled("Dashboard")), 8000);
      await this.click("Dashboard");
      await this.d.wait(
        async () =>
          (await this.d.findElement(By.tagName("body")).getText()).includes(
            name,
          ),
        8000,
      );
      await this.d.wait(async () => {
        try {
          const entry = await this.d.findElement(By.xpath('//*[@aria-label="Open analysis"][preceding-sibling::*[contains(., "' + name + '")]]'));
          await entry.click();
          return true;
        } catch (error) {
          if (["NoSuchElementError", "StaleElementReferenceError"].includes(error.name)) return false;
          throw error;
        }
      }, 8000);
      await this.d.wait(until.elementLocated(this.labelled("Saved")), 8000);
      const restored = await this.d.findElement(this.labelled("DNA sequence")).getAttribute("value");
      if (restored !== "ATGCNN") throw Error("Reopened sequence differs from saved input.");
      await this.click("Account");
    }
    await this.click("Sign out");
    await this.d.wait(
      until.elementLocated(this.labelled("DNA sequence")),
      8000,
    );
    return "visible";
  }
  async check(c) {
    if (c.action === "draft") {
      await this.click("Analyzer");
      await this.click("Clear");
      await this.d.findElement(this.labelled("DNA sequence")).sendKeys(c.raw);
      await this.click("Account");
      await this.click("Analyzer");
      return this.d
        .findElement(this.labelled("DNA sequence"))
        .getAttribute("value");
    }
    if (["signup", "recover"].includes(c.action)) {
      const register = c.action === "signup";
      c = {
        ...c,
        action: "accountForm",
        mode: register ? "Register" : "Forgot password",
        email: register
          ? "genescan-" + randomUUID() + "@example.test"
          : "fixture",
        password: register ? randomUUID() : "",
        matchPassword: register,
      };
    }
    if (c.action === "accountForm") return this.accountForm(c);
    if (Number(c.id) > 310) {
      await this.click("Analyzer");
      if (c.action === "auth") {
        await this.click("Account");
        await this.click(c.file);
        return (await this.d.findElement(this.labelled(c.target))).isDisplayed()
          ? "visible"
          : "hidden";
      }
      await this.click("Clear");
      if (c.action === "file") {
        await this.importFile(c.file, c.raw);
        if (!["example.csv", "large.txt"].includes(c.file))
          await this.click("Analyze");
      } else {
        const el = await this.d.findElement(this.labelled("DNA sequence"));
        await el.sendKeys(c.raw);
        if (c.action === "rotate") {
          await this.d.manage().window().setRect({ width: 480, height: 850 });
          const v = await el.getAttribute("value");
          await this.d.manage().window().setRect({ width: 1300, height: 900 });
          return v;
        }
        await this.click("Analyze");
        if (c.action === "clear") {
          await this.click("Clear");
          return el.getAttribute("value");
        }
        if (c.action === "save") {
          await this.click("Save analysis");
          return (
            await this.d.findElement(this.labelled("Email"))
          ).isDisplayed()
            ? "visible"
            : "hidden";
        }
      }
      const hit = await this.d.wait(
        until.elementLocated(By.css('[data-testid="' + c.target + '"]')),
        5000,
      );
      return hit.getText();
    }
    if (c.action !== "analyze") {
      await this.click("Account");
      if (c.action !== "Account") await this.click(c.action);
      return (await this.d.findElement(this.labelled(c.target))).isDisplayed()
        ? "visible"
        : "hidden";
    }
    const seq = await this.d.findElement(this.labelled("DNA sequence"));
    await this.click("Clear");
    // Paste semantics preserve literal tabs, CRLF and non-BMP characters.
    if (c.raw)
      await this.d.executeScript(
        `const el=arguments[0];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,arguments[1]);el.dispatchEvent(new Event('input',{bubbles:true}));`,
        seq,
        c.raw,
      );
    await this.click("Analyze");
    return this.d.wait(async () => {
      try {
        const el = await this.d.findElement(
          By.css('[data-testid="' + c.target + '"]'),
        );
        return (await el.getText()).replace(/\s+/g, " ").trim() || false;
      } catch {
        return false;
      }
    }, 5000);
  }
}
