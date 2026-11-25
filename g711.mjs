export const sampleRate = 8000;

// G.711 μ-law compresses each signed PCM sample into one byte.
export function encodeMuLaw(samples) {
  const output = new Uint8Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-32768, Math.min(32767, Math.round(samples[index] * 32768)));
    const sign = sample < 0 ? 0x80 : 0;
    const biased = Math.min(Math.abs(sample), 32635) + 132;
    const exponent = Math.floor(Math.log2(biased)) - 7;
    const mantissa = (biased >> (exponent + 3)) & 0x0f;
    output[index] = ~(sign | (exponent << 4) | mantissa) & 0xff;
  }
  return output;
}

export function muLawWave(bytes) {
  const headerSize = 58;
  const wave = new Uint8Array(headerSize + bytes.length + (bytes.length % 2));
  const view = new DataView(wave.buffer);
  const tag = (offset, value) => wave.set(new TextEncoder().encode(value), offset);
  const word = (offset, value) => view.setUint16(offset, value, true);
  const dword = (offset, value) => view.setUint32(offset, value, true);

  tag(0, "RIFF");
  dword(4, wave.length - 8);
  tag(8, "WAVE");
  tag(12, "fmt ");
  dword(16, 18);
  word(20, 0x0007); // WAVE_FORMAT_MULAW
  word(22, 1);
  dword(24, sampleRate);
  dword(28, sampleRate);
  word(32, 1);
  word(34, 8);
  word(36, 0);
  tag(38, "fact");
  dword(42, 4);
  dword(46, bytes.length);
  tag(50, "data");
  dword(54, bytes.length);
  wave.set(bytes, headerSize);
  return wave;
}
