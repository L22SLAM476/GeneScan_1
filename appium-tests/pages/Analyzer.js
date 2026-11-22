import { randomUUID } from "node:crypto";
export class Analyzer {
  constructor(driver) {
    this.d = driver;
  }
  async element(label) {
    let el = await this.d.$("~" + label);
    try {
      await el.waitForExist({ timeout: 3000 });
    } catch {
      el = await this.d.$(
        "android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description(" +
          JSON.stringify(label) +
          "))",
      );
      await el.waitForExist({ timeout: 6000 });
    }
    return el;
  }
  async click(label) {
    let el = await this.d.$("~" + label);
    if (!(await el.isExisting()) || !(await el.isDisplayed()))
      el = await this.d.$(
        "android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description(" +
          JSON.stringify(label) +
          "))",
      );
    await el.click();
  }
  async check(c) {
    if ((await this.d.getCurrentPackage()) !== "org.genescan.analyzer")
      await this.d.activateApp("org.genescan.analyzer");
    if (await this.d.isKeyboardShown()) await this.d.hideKeyboard();
    if (
      ["draft", "androidBack", "keyboardBack", "backgroundDraft"].includes(
        c.action,
      )
    ) {
      await this.click("Analyzer");
      await this.click("Clear");
      const input = await this.element("DNA sequence");
      await input.click();
      await input.setValue(c.raw);
      if (c.action === "keyboardBack") {
        await this.d.waitUntil(() => this.d.isKeyboardShown());
        await this.d.pressKeyCode(4);
        await this.d.waitUntil(async () => !(await this.d.isKeyboardShown()));
      } else {
        if (await this.d.isKeyboardShown()) await this.d.hideKeyboard();
        if (c.action === "backgroundDraft") { await this.d.background(2); await this.d.activateApp("org.genescan.analyzer"); }
        else {
          await this.click("Account");
          if (c.action === "androidBack") await this.d.pressKeyCode(4);
          else await this.click("Analyzer");
        }
      }
      return (await this.element("DNA sequence")).getText();
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
    if (c.action === "accountForm") {
      await this.click("Account");
      const existingSignOut = await this.d.$("~Sign out");
      if (await existingSignOut.isExisting()) {
        await existingSignOut.click();
        await this.element("DNA sequence");
        await this.click("Account");
      }
      if (!["Sign in", "persist", "logout"].includes(c.mode))
        await this.click(c.mode);
      const fill = async (label, value) => {
        const el = await this.element(label);
        await el.clearValue();
        if (value) await el.setValue(value);
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
      if (["persist", "logout"].includes(c.mode)) {
        await this.element("Sign out");
        if (c.mode === "persist") {
          await this.click("Analyzer");
          await this.click("Clear");
          const name = "native-" + Date.now();
          await fill("Sequence name", name);
          await fill("DNA sequence", "ACGT");
          await this.click("Analyze");
          await this.click("Save analysis");
          await this.element("Saved");
          await this.d.background(2);
          await this.click("Dashboard");
          await this.d.$(
            'android=new UiSelector().textContains("Total saved analyses")',
          ).waitForExist({ timeout: 8000 });
          const savedRow = await this.d.$(
            "android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().textContains(" +
              JSON.stringify(name) +
              "))",
          );
          await savedRow.waitForExist({ timeout: 8000 });
          await this.click("Account");
        }
        await this.click("Sign out");
        await this.element("DNA sequence");
        return "visible";
      }
    } else if (Number(c.id) > 310) {
      await this.click("Analyzer");
      if (c.action === "auth") {
        await this.click("Account");
        await this.click(c.file);
        return (await this.element(c.target)).isExisting()
          ? "visible"
          : "hidden";
      }
      await this.click("Clear");
      if (c.action === "file") {
        const fixtureName = `genescan-${c.id}-${c.file}`;
        await this.d.pushFile(
          "/sdcard/Download/" + fixtureName,
          Buffer.from(c.raw).toString("base64"),
        );
        await this.click("Import file");
        const target = 'android=new UiSelector().text(' + JSON.stringify(fixtureName) + ')';
        const file = await this.d.$(target);
        if (!(await file.isDisplayed())) {
          const roots = await this.d.$("~Show roots");
          await roots.waitForDisplayed();
          await roots.click();
          const downloads = await this.d.$('android=new UiSelector().resourceIdMatches(".*:id/title").text("Downloads")');
          await downloads.waitForDisplayed();
          await downloads.click();
        }
        await file.waitForDisplayed({ timeout: 12000 });
        await file.click();
        if (!["example.csv", "large.txt"].includes(c.file))
          await this.click("Analyze");
      } else {
        const el = await this.element("DNA sequence");
        await el.setValue(c.raw);
        if (await this.d.isKeyboardShown()) await this.d.hideKeyboard();
        if (c.action === "rotate") {
          await this.d.setOrientation("LANDSCAPE");
          const v = await el.getText();
          await this.d.setOrientation("PORTRAIT");
          return v;
        }
        await this.click("Analyze");
        if (c.action === "clear") {
          await this.click("Clear");
          const input = await this.element("DNA sequence");
          const text = await input.getText();
          return text.startsWith(">sample_01") ? "" : text;
        }
        if (c.action === "save") {
          await this.click("Save analysis");
          return (await this.element("Email")).isExisting()
            ? "visible"
            : "hidden";
        }
      }
    } else if (c.action !== "analyze") {
      await this.click("Account");
      if (c.action !== "Account") await this.click(c.action);
      return (await this.element(c.target)).isExisting() ? "visible" : "hidden";
    }
    if (c.action === "analyze") {
      await this.click("Clear");
      const el = await this.element("DNA sequence");
      if (c.raw) await el.setValue(c.raw);
      if (await this.d.isKeyboardShown()) await this.d.hideKeyboard();
      await this.click("Analyze");
    }
    const byId =
      "new UiSelector().resourceIdMatches(" +
      JSON.stringify("(.+:id/)?" + c.target) +
      ")";
    let value = await this.d.$("android=" + byId);
    if (c.target === "message")
      await value.waitForExist({ timeout: 8000 }).catch(() => {});
    if (!(await value.isExisting()) && c.target === "message") {
      await this.d.$(
        "android=new UiScrollable(new UiSelector().scrollable(true)).scrollToBeginning(5)",
      ).catch(() => {});
      value = await this.d.$("android=" + byId);
    }
    if (!(await value.isExisting()))
      value = await this.d.$(
        "android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(" +
          byId +
          ")",
      );
    return (await value.getText()).replace(/\s+/g, " ").trim();
  }
}
