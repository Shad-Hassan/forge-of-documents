// Minimal line diff (LCS). Pure, client-safe. Good for drafts up to a few thousand lines.
export type DiffLine = { op: " " | "+" | "-"; text: string };

export function lineDiff(a: string, b: string): DiffLine[] {
  const x = a.split("\n"), y = b.split("\n");
  const n = x.length, m = y.length;
  // dp[i][j] = LCS length of x[i:] and y[j:]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ op: " ", text: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "-", text: x[i++] });
    else out.push({ op: "+", text: y[j++] });
  }
  while (i < n) out.push({ op: "-", text: x[i++] });
  while (j < m) out.push({ op: "+", text: y[j++] });
  return out;
}

/** Keep only changed lines plus `ctx` lines of context around them. */
export function compact(lines: DiffLine[], ctx = 2): Array<DiffLine | { op: "…"; text: string }> {
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.op !== " ") for (let k = Math.max(0, i - ctx); k <= Math.min(lines.length - 1, i + ctx); k++) keep.add(k);
  });
  const out: Array<DiffLine | { op: "…"; text: string }> = [];
  let last = -1;
  [...keep].sort((p, q) => p - q).forEach((i) => {
    if (last >= 0 && i > last + 1) out.push({ op: "…", text: "" });
    out.push(lines[i]);
    last = i;
  });
  return out;
}
