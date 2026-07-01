import { deflateSync, inflateSync } from "node:zlib";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = makeCrcTable();

export interface DecodedPng {
  width: number;
  height: number;
  data: Uint8Array;
}

export function readPng(buffer: Buffer): DecodedPng {
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Invalid PNG signature.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (![0, 2, 6].includes(colorType)) throw new Error(`Unsupported PNG color type: ${colorType}`);
  if (interlace !== 0) throw new Error("Interlaced PNGs are not supported.");

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const raw = unfilterScanlines(inflated, width, height, bytesPerPixel);
  return {
    width,
    height,
    data: toRgba(raw, width, height, colorType),
  };
}

export function writePng(image: DecodedPng): Buffer {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);

  for (let y = 0; y < image.height; y += 1) {
    const rawOffset = y * (image.width * 4 + 1);
    raw[rawOffset] = 0;
    Buffer.from(image.data.buffer, image.data.byteOffset + y * image.width * 4, image.width * 4)
      .copy(raw, rawOffset + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    pngSignature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function unfilterScanlines(
  inflated: Buffer,
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array {
  const stride = width * bytesPerPixel;
  const raw = new Uint8Array(height * stride);
  let inputOffset = 0;
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const output = raw.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x += 1) {
      const byte = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? output[x - bytesPerPixel] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] ?? 0 : 0;

      output[x] = (byte + filterValue(filter, left, up, upLeft)) & 0xff;
    }

    inputOffset += stride;
    previous = output;
  }

  return raw;
}

function filterValue(filter: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4:
      return paeth(left, up, upLeft);
    default:
      throw new Error(`Unsupported PNG filter type: ${filter}`);
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function toRgba(raw: Uint8Array, width: number, height: number, colorType: number): Uint8Array {
  if (colorType === 6) return raw;

  const data = new Uint8Array(width * height * 4);
  const sourceStep = colorType === 2 ? 3 : 1;

  for (let source = 0, target = 0; target < data.length; source += sourceStep, target += 4) {
    if (colorType === 2) {
      data[target] = raw[source];
      data[target + 1] = raw[source + 1];
      data[target + 2] = raw[source + 2];
    } else {
      data[target] = raw[source];
      data[target + 1] = raw[source];
      data[target + 2] = raw[source];
    }
    data[target + 3] = 255;
  }

  return data;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makeCrcTable(): number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
