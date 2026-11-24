// Port of Python 3.12 textwrap.wrap() with defaults (break_long_words, break_on_hyphens, drop_whitespace).
// Length is counted in UTF-16 code units; the fixtures are ASCII/BMP.

const WS = "[\\t\\n\\x0b\\x0c\\r ]";
const NWS = "[^\\t\\n\\x0b\\x0c\\r ]";
const WP = "[A-Za-z0-9_!\"'&.,?]";
const LT = "[A-Za-z_]";
const WORDSEP = new RegExp(
  `(${WS}+|(?<=${WP})-{2,}(?=\\w)|${NWS}+?(?:-(?:(?<=${LT}{2}-)|(?<=${LT}-${LT}-))(?=${LT}-?${LT})|(?=${WS}|(?![\\s\\S]))|(?<=${WP})(?=-{2,}\\w)))`
);

function splitChunks(text: string): string[] {
  return text.split(WORDSEP).filter((c) => c.length > 0);
}

function handleLongWord(rc: string[], cur: string[], curLen: number, width: number): void {
  const spaceLeft = width < 1 ? 1 : width - curLen;
  let end = spaceLeft;
  const chunk = rc[rc.length - 1];
  if (chunk.length > spaceLeft) {
    const hyphen = spaceLeft <= 0 ? -1 : chunk.lastIndexOf("-", spaceLeft - 1);
    if (hyphen > 0 && chunk.slice(0, hyphen).split("").some((c) => c !== "-")) end = hyphen + 1;
  }
  cur.push(chunk.slice(0, end));
  rc[rc.length - 1] = chunk.slice(end);
}

export function pyWrap(text: string, width: number): string[] {
  const munged = text.replace(/[\t\n\x0b\x0c\r]/g, " ");
  const chunks = splitChunks(munged);
  chunks.reverse();
  const lines: string[] = [];
  while (chunks.length) {
    const cur: string[] = [];
    let curLen = 0;
    if (chunks[chunks.length - 1].trim() === "" && lines.length) chunks.pop();
    while (chunks.length) {
      const l = chunks[chunks.length - 1].length;
      if (curLen + l <= width) {
        cur.push(chunks.pop() as string);
        curLen += l;
      } else break;
    }
    if (chunks.length && chunks[chunks.length - 1].length > width) {
      handleLongWord(chunks, cur, curLen, width);
      curLen = cur.reduce((a, c) => a + c.length, 0);
    }
    if (cur.length && cur[cur.length - 1].trim() === "") {
      cur.pop();
    }
    if (cur.length) lines.push(cur.join(""));
  }
  return lines;
}
