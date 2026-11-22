export const complement = Object.freeze({
  A: "T",
  T: "A",
  C: "G",
  G: "C",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  V: "B",
  D: "H",
  H: "D",
  N: "N",
});
export const limit = 100000;
export function analyze(raw) {
  if (typeof raw !== "string" || raw.length > 2 * limit)
    throw Error("Input exceeds the 200,000-character limit.");
  const lines = raw.trim().split(/\r\n?|\n/);
  if (lines[0].startsWith(">")) {
    if (!lines.shift().slice(1).trim())
      throw Error("A FASTA header needs a name.");
  }
  if (lines.some((line) => line.startsWith(">")))
    throw Error("Analyze one FASTA record at a time.");
  const input = lines.join("").replace(/\s/g, "");
  if (!input) throw Error("Enter a DNA sequence.");
  if (input.length > limit) throw Error("Maximum length is 100,000 bases.");
  if (/[^acgtryswkmbdhvn]/i.test(input))
    throw Error("Use IUPAC DNA letters only.");
  const sequence = input.toUpperCase(),
    counts = Object.fromEntries(Object.keys(complement).map((k) => [k, 0]));
  for (const base of sequence) counts[base]++;
  const gc = counts.G + counts.C,
    at = counts.A + counts.T,
    known = gc + at;
  return {
    sequence,
    length: sequence.length,
    counts,
    frequencies: Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v / sequence.length]),
    ),
    ambiguous: sequence.length - known,
    gc: known ? (100 * gc) / known : null,
    at: known ? (100 * at) / known : null,
    ratio: gc ? at / gc : null,
    reverse: [...sequence]
      .reverse()
      .map((b) => complement[b])
      .join(""),
    timestamp: new Date().toISOString(),
  };
}
export function validateFile(name, size) {
  if (!/\.(txt|fa|fasta|fna)$/i.test(name))
    throw Error("Choose a FASTA or TXT file.");
  if (size > 200000) throw Error("File exceeds 200 KB.");
}
