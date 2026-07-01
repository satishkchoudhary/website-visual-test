import { readFile, writeFile } from "node:fs/promises";
import { ensureParentDir } from "../lib/files.js";
import { readPng, writePng } from "./png.js";

export interface ImageDiffResult {
  width: number;
  height: number;
  totalPixels: number;
  mismatchedPixels: number;
  mismatchPercentage: number;
  dimensionMismatch: boolean;
}

export async function comparePngFiles(
  baselinePath: string,
  targetPath: string,
  diffPath: string,
  pixelThreshold: number,
): Promise<ImageDiffResult> {
  const baseline = readPng(await readFile(baselinePath));
  const target = readPng(await readFile(targetPath));
  const width = Math.max(baseline.width, target.width);
  const height = Math.max(baseline.height, target.height);
  const totalPixels = width * height;
  const diffData = new Uint8Array(totalPixels * 4);
  let mismatchedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetIndex = (y * width + x) * 4;
      const baselinePixel = pixelAt(baseline, x, y);
      const targetPixel = pixelAt(target, x, y);
      const mismatch = !baselinePixel || !targetPixel || maxChannelDelta(baselinePixel, targetPixel) > pixelThreshold;

      if (mismatch) {
        mismatchedPixels += 1;
        diffData[targetIndex] = targetPixel?.[0] ?? 0;
        diffData[targetIndex + 1] = 40;
        diffData[targetIndex + 2] = baselinePixel ? 40 : 255;
        diffData[targetIndex + 3] = 255;
      } else {
        const gray = Math.round(((baselinePixel[0] + baselinePixel[1] + baselinePixel[2]) / 3) * 0.45 + 140);
        diffData[targetIndex] = gray;
        diffData[targetIndex + 1] = gray;
        diffData[targetIndex + 2] = gray;
        diffData[targetIndex + 3] = 255;
      }
    }
  }

  await ensureParentDir(diffPath);
  await writeFile(diffPath, writePng({ width, height, data: diffData }));

  return {
    width,
    height,
    totalPixels,
    mismatchedPixels,
    mismatchPercentage: totalPixels === 0 ? 0 : mismatchedPixels / totalPixels,
    dimensionMismatch: baseline.width !== target.width || baseline.height !== target.height,
  };
}

type RgbaPixel = [number, number, number, number];

function pixelAt(image: { width: number; height: number; data: Uint8Array }, x: number, y: number): RgbaPixel | null {
  if (x >= image.width || y >= image.height) return null;
  const index = (y * image.width + x) * 4;
  return [
    image.data[index],
    image.data[index + 1],
    image.data[index + 2],
    image.data[index + 3],
  ];
}

function maxChannelDelta(a: RgbaPixel, b: RgbaPixel): number {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2]),
    Math.abs(a[3] - b[3]),
  );
}
