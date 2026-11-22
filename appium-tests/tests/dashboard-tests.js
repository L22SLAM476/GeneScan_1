import { suite } from "../helpers/suite.js";
suite(
  "Dashboard navigation",
  (c) =>
    ["Dashboard", "Analyzer"].includes(c.action) || c.module === "Dashboard",
);
