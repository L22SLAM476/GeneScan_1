import { suite } from "../helpers/suite.js";
suite(
  "Registration",
  (c) => c.action === "Register" || c.module === "Registration",
);
