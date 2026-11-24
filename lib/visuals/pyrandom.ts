// CPython random.Random: MT19937 seeded by init_by_array, random(), uniform(), gauss(), choice(),
// choices(weights), sample(range). Matches CPython 3.12 for non-negative int seeds below 2**32.

export class PyRandom {
  private mt = new Uint32Array(624);
  private idx = 625;
  private gaussNext: number | null = null;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const p = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (Math.imul(1812433253, p) + i) >>> 0;
    }
    this.idx = 624;
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    const mt = this.mt;
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(p, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        mt[0] = mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(p, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        mt[0] = mt[623];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
    this.idx = 624;
  }

  private genrand(): number {
    const mt = this.mt;
    if (this.idx >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (mt[kk] & 0x80000000) | (mt[(kk + 1) % 624] & 0x7fffffff);
        mt[kk] = mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.idx = 0;
    }
    let y = mt[this.idx++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.genrand() >>> 5;
    const b = this.genrand() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  gauss(mu: number, sigma: number): number {
    let z = this.gaussNext;
    this.gaussNext = null;
    if (z === null) {
      const x2pi = this.random() * (2 * Math.PI);
      const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussNext = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }

  private getrandbits(k: number): number {
    return this.genrand() >>> (32 - k);
  }

  randbelow(n: number): number {
    const k = n.toString(2).length;
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }

  choice<T>(seq: T[]): T {
    return seq[this.randbelow(seq.length)];
  }

  /** random.choices(population, weights, k=1)[0] */
  choiceWeighted<T>(population: T[], weights: number[]): T {
    const cum: number[] = [];
    let total = 0;
    for (const w of weights) {
      total += w;
      cum.push(total);
    }
    const hi = population.length - 1;
    const target = this.random() * total;
    let lo = 0;
    let h = hi;
    while (lo < h) {
      const mid = (lo + h) >> 1;
      if (target < cum[mid]) h = mid;
      else lo = mid + 1;
    }
    return population[lo];
  }

  /** random.sample(range(start, stop), k) with CPython's pool/set selection. */
  sampleRange(start: number, stop: number, k: number): number[] {
    const n = stop - start;
    let setsize = 21;
    if (k > 5) setsize += Math.pow(4, Math.ceil(Math.log(k * 3) / Math.log(4)));
    const result: number[] = new Array(k);
    if (n <= setsize) {
      const pool: number[] = [];
      for (let i = 0; i < n; i++) pool.push(start + i);
      for (let i = 0; i < k; i++) {
        const j = this.randbelow(n - i);
        result[i] = pool[j];
        pool[j] = pool[n - i - 1];
      }
    } else {
      const selected = new Set<number>();
      for (let i = 0; i < k; i++) {
        let j = this.randbelow(n);
        while (selected.has(j)) j = this.randbelow(n);
        selected.add(j);
        result[i] = start + j;
      }
    }
    return result;
  }
}
