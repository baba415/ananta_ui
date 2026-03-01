const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(timeMs: number): string {
  let time = timeMs;
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out = ENCODING[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";

  // 16 bytes => 128 bits => 26 Crockford base32 chars (130 bits; last char uses 2 bits)
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      const index = (buffer >>> (bits - 5)) & 31;
      out += ENCODING[index];
      bits -= 5;
    }
  }
  if (bits > 0) {
    const index = (buffer << (5 - bits)) & 31;
    out += ENCODING[index];
  }
  return out.slice(0, 16);
}

export function ulid(nowMs: number = Date.now()): string {
  return `${encodeTime(nowMs)}${encodeRandom()}`;
}

