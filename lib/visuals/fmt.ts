// Python-faithful number and string formatting for SVG output.
// Source semantics: Python 3 f-strings ({x:.Nf}), round(), str(float), html.escape.

const buf = new Float64Array(1);
const bits = new BigUint64Array(buf.buffer);

/** Python '%.{digits}f' / f"{x:.{digits}f}": exact binary value, round-half-even. */
export function pyFixed(x: number, digits: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  const neg = x < 0 || Object.is(x, -0);
  const v = Math.abs(x);
  buf[0] = v;
  const b = bits[0];
  const expBits = Number((b >> BigInt(52)) & BigInt(0x7ff));
  const frac = b & BigInt("0xfffffffffffff");
  const m = expBits === 0 ? frac : frac | BigInt("0x10000000000000");
  const e = expBits === 0 ? -1074 : expBits - 1075;
  const pow10 = BigInt(10) ** BigInt(digits);
  let q: bigint;
  if (e >= 0) {
    q = (m << BigInt(e)) * pow10;
  } else {
    const num = m * pow10;
    const den = BigInt(1) << BigInt(-e);
    q = num / den;
    const r = num - q * den;
    const twice = r * BigInt(2);
    if (twice > den || (twice === den && q % BigInt(2) === BigInt(1))) q += BigInt(1);
  }
  let s = q.toString();
  if (digits > 0) {
    if (s.length <= digits) s = "0".repeat(digits - s.length + 1) + s;
    s = s.slice(0, s.length - digits) + "." + s.slice(s.length - digits);
  }
  return (neg ? "-" : "") + s;
}

/** Python round(x) with no ndigits: half to even. Returns a JS integer-valued number. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** Python float // float (CPython float_floor_div). */
export function pyFloorDiv(a: number, b: number): number {
  let mod = a % b;
  let div = (a - mod) / b;
  if (mod !== 0) {
    if ((b < 0) !== (mod < 0)) {
      mod += b;
      div -= 1;
    }
  } else {
    mod = b < 0 ? -0 : 0;
  }
  let floordiv: number;
  if (div !== 0) {
    floordiv = Math.floor(div);
    if (div - floordiv > 0.5) floordiv += 1;
  } else {
    floordiv = (a / b < 0 || Object.is(a / b, -0)) ? -0 : 0;
  }
  return floordiv;
}

/** Python str(float) for the values used here: repr with a trailing ".0" on integral floats. */
export function pyRepr(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  return String(x);
}

/** Python _f in warden_world.py: f"{v:.1f}".rstrip("0").rstrip("."). */
export function fmtF(v: number): string {
  return pyFixed(v, 1).replace(/0+$/, "").replace(/\.+$/, "");
}

/** Python html.escape(s, quote=True). */
export function htmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
