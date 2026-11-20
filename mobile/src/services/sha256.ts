/**
 * Small dependency-free SHA-256 helper for the in-app APK updater.
 *
 * The updater reads the downloaded file in small base64 chunks through
 * expo-file-system, decodes each chunk here and feeds it to an incremental
 * hasher. No native module, no extra dependency and no 42 MB allocation, so
 * this cannot change the Android build graph or strain low-end devices.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_STATE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Decode a standard base64 string (with optional padding) to raw bytes. */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[\r\n\s]/g, '');
  if (clean.length % 4 !== 0) {
    throw new Error('Invalid base64 data');
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < alphabet.length; i += 1) {
    lookup[alphabet.charCodeAt(i)] = i;
  }

  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;

  const outLength = Math.floor((clean.length * 3) / 4) - padding;
  if (outLength < 0) throw new Error('Invalid base64 data');
  const out = new Uint8Array(outLength);
  let o = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = clean.charCodeAt(i);
    const c2 = clean.charCodeAt(i + 1);
    const c3 = i + 2 < clean.length ? clean.charCodeAt(i + 2) : 61;
    const c4 = i + 3 < clean.length ? clean.charCodeAt(i + 3) : 61;

    const v1 = c1 < 128 ? lookup[c1] : -1;
    const v2 = c2 < 128 ? lookup[c2] : -1;
    const v3 = c3 < 128 ? lookup[c3] : -1;
    const v4 = c4 < 128 ? lookup[c4] : -1;

    if (v1 < 0 || v2 < 0) throw new Error('Invalid base64 data');
    const bits = (v1 << 18) | (v2 << 12) | ((v3 < 0 ? 0 : v3) << 6) | (v4 < 0 ? 0 : v4);

    out[o++] = (bits >>> 16) & 0xff;
    if (v3 >= 0 && o < outLength) out[o++] = (bits >>> 8) & 0xff;
    if (v4 >= 0 && o < outLength) out[o++] = bits & 0xff;
  }

  return out;
}

export interface Sha256Hasher {
  update(bytes: Uint8Array): void;
  digest(): string;
}

/** Incremental SHA-256: feed arbitrary chunks, then call digest(). */
export function createSha256(): Sha256Hasher {
  const h = INITIAL_STATE.slice();
  const w = new Uint32Array(64);
  const block = new Uint8Array(64);
  const blockView = new DataView(block.buffer);
  const tail = new Uint8Array(64);
  let buffered = 0;
  let totalBytes = 0;

  const compress = (source: Uint8Array, offset: number): void => {
    block.set(source.subarray(offset, offset + 64));
    for (let t = 0; t < 16; t += 1) {
      w[t] = blockView.getUint32(t * 4, false);
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  };

  return {
    update(bytes: Uint8Array): void {
      totalBytes += bytes.length;
      let i = 0;

      if (buffered > 0) {
        const take = Math.min(64 - buffered, bytes.length);
        tail.set(bytes.subarray(0, take), buffered);
        buffered += take;
        i += take;
        if (buffered === 64) {
          compress(tail, 0);
          buffered = 0;
        }
      }

      while (i + 64 <= bytes.length) {
        compress(bytes, i);
        i += 64;
      }

      if (i < bytes.length) {
        tail.set(bytes.subarray(i), 0);
        buffered = bytes.length - i;
      }
    },

    digest(): string {
      const zeros = ((56 - ((buffered + 1) % 64)) + 64) % 64;
      const finalLength = buffered + 1 + zeros + 8;
      const final = new Uint8Array(finalLength);
      final.set(tail.subarray(0, buffered), 0);
      final[buffered] = 0x80;

      const bits = totalBytes * 8;
      const view = new DataView(final.buffer);
      view.setUint32(finalLength - 8, Math.floor(bits / 0x100000000), false);
      view.setUint32(finalLength - 4, bits % 0x100000000, false);

      for (let offset = 0; offset < finalLength; offset += 64) {
        compress(final, offset);
      }

      return h.map((value) => value.toString(16).padStart(8, '0')).join('');
    },
  };
}

/** Return the lowercase hex SHA-256 of arbitrary bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  const hasher = createSha256();
  hasher.update(bytes);
  return hasher.digest();
}

/** Normalise a published hash so formatting never causes a false mismatch. */
export function normaliseSha256(value?: string | null): string | null {
  if (!value) return null;
  const hex = value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
  return hex.length === 64 ? hex : null;
}
