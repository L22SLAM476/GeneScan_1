import { suite } from "../helpers/suite.js";
suite(
  "Account and recovery",
  (c) =>
    ["Account", "Forgot password", "Show password"].includes(c.action) ||
    ["Authentication", "Recovery", "Database integration"].includes(c.module),
);
