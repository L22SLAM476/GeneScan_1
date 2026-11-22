import { suite } from "../helpers/suite.js";
suite(
  "Native analyzer",
  (c) =>
    (c.action === "analyze" && c.module !== "Validation") ||
    c.module === "Interface",
);
