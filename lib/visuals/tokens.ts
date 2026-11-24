// Copied from ART/src/warden_base.py TOKENS (values identical). Only the keys warden_flow.py reads.
// Source: /home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/src/warden_base.py (TOKENS). Not imported from warden_base.

export type WardenMode = "cosmic" | "print";

export const TOKENS: Record<WardenMode, Record<string, string>> = {
  print: {
    cell: "#FAFCFD", ink: "#141A21", soft: "#46525E", rule: "#C6D1DA",
    frost: "#2C6488", glacier: "#8DB8D3", steel: "#5E7A96", info: "#8A6414", ok: "#2F6B4F",
  },
  cosmic: {
    cell: "#111317", ink: "#F5F5F5", soft: "#B0B6BF", rule: "#2A2E35",
    frost: "#5683DA", glacier: "#8FB0F0", steel: "#6E86B0", info: "#E3B45A", ok: "#4FBF8A",
  },
};
