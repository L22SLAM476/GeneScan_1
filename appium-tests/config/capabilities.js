export default {
  platformName: "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": process.env.DEVICE_NAME || "Android Emulator",
  "appium:appPackage": "org.genescan.analyzer",
  "appium:appActivity": ".MainActivity",
  "appium:noReset": false,
  "appium:autoGrantPermissions": true,
  "appium:newCommandTimeout": 180,
  "appium:settings[waitForIdleTimeout]": 250,
  ...(process.env.ANDROID_SERIAL ? { "appium:udid": process.env.ANDROID_SERIAL } : {}),
};
