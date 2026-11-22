import accountCases from "./account-scenarios.js";
import { extras } from "./extra-scenarios.js";
// The oracle is independent of the application. Each ordered IUPAC pair
// exercises a distinct reverse-complement mapping across adjacent positions.
const alphabet = "ACGTRYSWKMBDHVN",
  inverse = "TGCAYRSWMKVHDBN";
const cases = [];
function add(module, title, raw, target, expected, action = "analyze") {
  cases.push({ module, title, raw, target, expected, action });
}
for (const [i, left] of [...alphabet].entries())
  for (const [j, right] of [...alphabet].entries()) {
    add(
      "Reverse complement",
      "Reverse and complement " + left + right,
      left + right,
      "reverse",
      inverse[j] + inverse[i],
    );
  }
for (const [i, b] of [...alphabet].entries()) {
  add(
    "Normalization",
    "Normalize lowercase " + b + " within FASTA",
    ">sample " + b + "\r\n" + b.toLowerCase() + "\tA",
    "reverse",
    "T" + inverse[i],
  );
  add(
    "Composition",
    "Count repeated " + b + " alongside a canonical anchor",
    b.repeat(3) + "T",
    "count-" + b,
    b + " " + (b === "T" ? "4 · 100%" : "3 · 75%"),
  );
  if (i >= 4)
    add(
      "Ambiguity",
      "Exclude " + b + " from the GC denominator",
      "GGAT" + b,
      "GC content",
      "GC content 50%",
    );
}
for (const [seq, gc, at, ratio] of [
  ["A", 0, 100, "Undefined"],
  ["C", 100, 0, "0"],
  ["GAT", 33.33, 66.67, "2"],
  ["GCAT", 50, 50, "1"],
  ["NGGC", 100, 0, "0"],
  ["N", null, null, "Undefined"],
  ["NNTA", 0, 100, "Undefined"],
  ["CCCCCT", 83.33, 16.67, "0.2"],
]) {
  for (const [label, value] of [
    ["GC content", gc === null ? "Undefined" : gc + "%"],
    ["AT content", at === null ? "Undefined" : at + "%"],
    ["AT/GC ratio", ratio],
  ])
    add("Statistics", label + " for " + seq, seq, label, label + " " + value);
}
for (const [raw, msg] of [
  ["", "Enter a DNA sequence."],
  ["  ", "Enter a DNA sequence."],
  [">", "A FASTA header needs a name."],
  [">name", "Enter a DNA sequence."],
  [">a\nA\n>b\nC", "Analyze one FASTA record at a time."],
  ...["U", "0", "-", "?", "*", "/", "<script>", "Ａ", "🧬"].map((c) => [
    "AC" + c,
    "Use IUPAC DNA letters only.",
  ]),
])
  add("Validation", "Reject " + JSON.stringify(raw), raw, "message", msg);
for (const [name, button, target] of [
  ["Protected dashboard", "Dashboard", "Email"],
  ["Account navigation", "Account", "Password"],
  ["Registration confirmation", "Register", "Confirm password"],
  ["Recovery email", "Forgot password", "Email"],
  ["Password visibility", "Show password", "Hide password"],
  ["Return to analyzer", "Analyzer", "DNA sequence"],
])
  add("Navigation", name, "", target, "visible", button);
export default cases
  .map((c, i) => ({ ...c, id: String(i + 1).padStart(3, "0") }))
  .concat(extras, accountCases, [
    {
      id: "333",
      module: "Registration",
      title: "Sign in immediately after registering a new fixture account",
      action: "signup",
      raw: "",
      target: "message",
      expected: "Account created. You are signed in.",
    },
    {
      id: "334",
      module: "Recovery",
      title: "Request a recovery email for the fixture account",
      action: "recover",
      raw: "",
      target: "message",
      expected: "Check your email for the next step.",
    },
    {
      id: "335",
      module: "Interface",
      title: "Retain an unsaved sequence across account navigation",
      action: "draft",
      raw: "ATCNN",
      target: "DNA sequence",
      expected: "ATCNN",
    },
  ]).filter(c => !["308", "321", "330", "334"].includes(c.id));

export const mobileCases = [
  {
    id: "336",
    module: "Interface",
    title: "Return to the draft with Android system back",
    action: "androidBack",
  },
  {
    id: "337",
    module: "Interface",
    title: "Preserve sequence when the app enters the background",
    action: "backgroundDraft",
  },
  {
    id: "338",
    module: "Interface",
    title: "Dismiss the native keyboard without leaving the analyzer",
    action: "keyboardBack",
  },
].map((c) => ({ ...c, raw: "GGAN", target: "DNA sequence", expected: "GGAN" }));
