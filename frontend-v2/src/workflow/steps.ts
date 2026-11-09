export const STEPS = [
  { id: "upload", number: "01", name: "Upload" },
  { id: "convert", number: "02", name: "Convert" },
  { id: "tagmap", number: "03", name: "Confirm names" },
  { id: "verify", number: "04", name: "Run comparison" },
  { id: "report", number: "05", name: "Report" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
