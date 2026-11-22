import { suite } from "../helpers/suite.js";
suite(
  "Sequence input validation",
  (c) => c.module === "Validation" || c.module === "File uploads",
);
