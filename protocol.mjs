// kuando UC Alpha/Omega HID output: seven 8-byte steps and an 8-byte footer.
export const filters = [
  ...[0x3bca, 0x3bcb, 0x3bcd, 0x3bce, 0x3bcf].map(productId => ({ vendorId: 0x27bb, productId })),
  { vendorId: 0x04d8, productId: 0xf848 },
];

function buildReport(step) {
  const report = new Uint8Array(64);
  report.set(step);
  report.set([0x0f, 0xff], 60);
  const checksum = report.reduce((sum, byte) => sum + byte, 0);
  new DataView(report.buffer).setUint16(62, checksum, false);
  return report;
}

export function colourReport(hex, brightness) {
  if (!/^#[\da-f]{6}$/i.test(hex) || !Number.isFinite(brightness) || brightness < 0 || brightness > 100) {
    throw new RangeError("Expected a six-digit hex colour and brightness from 0 to 100.");
  }
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  return buildReport([0x10, 0, ...rgb.map(channel => Math.round(channel * brightness / 255))]);
}

export function keepaliveReport() {
  return buildReport([0x8f]);
}
