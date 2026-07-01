import path from "node:path";
import { readJson, writeJson } from "./lib/files.js";

export interface PresetOptions {
  baselineUrl: string;
  targetUrl: string;
  urlSource: string;
  maxPages: number;
  threshold: number;
  waitUntil: string;
  sitemaps: string;
  viewports: string;
}

export interface VisualPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  options: PresetOptions;
}

export interface SavePresetInput {
  id?: string;
  name: string;
  options: Partial<PresetOptions>;
}

const presetsFile = path.join(process.cwd(), "visual", "presets.json");

export async function listPresets(): Promise<VisualPreset[]> {
  try {
    const presets = await readJson<VisualPreset[]>(presetsFile);
    return presets.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function savePreset(input: SavePresetInput): Promise<VisualPreset> {
  const name = input.name.trim();
  if (!name) throw new Error("Preset name is required.");

  const presets = await listPresets();
  const now = new Date().toISOString();
  const existingIndex = findPresetIndex(presets, input.id, name);
  const existing = existingIndex >= 0 ? presets[existingIndex] : undefined;
  const preset: VisualPreset = {
    id: existing?.id || uniqueId(name, presets),
    name,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    options: normalizeOptions(input.options),
  };

  if (existingIndex >= 0) {
    presets[existingIndex] = preset;
  } else {
    presets.push(preset);
  }

  await writeJson(presetsFile, presets.sort((a, b) => a.name.localeCompare(b.name)));
  return preset;
}

export async function deletePreset(id: string): Promise<boolean> {
  const presets = await listPresets();
  const next = presets.filter((preset) => preset.id !== id);
  if (next.length === presets.length) return false;
  await writeJson(presetsFile, next);
  return true;
}

function findPresetIndex(presets: VisualPreset[], id: string | undefined, name: string): number {
  if (id) {
    const byId = presets.findIndex((preset) => preset.id === id);
    if (byId >= 0) return byId;
  }

  return presets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
}

function normalizeOptions(options: Partial<PresetOptions>): PresetOptions {
  return {
    baselineUrl: String(options.baselineUrl || ""),
    targetUrl: String(options.targetUrl || ""),
    urlSource: String(options.urlSource || "sitemap"),
    maxPages: numberOrDefault(options.maxPages, 25),
    threshold: numberOrDefault(options.threshold, 0.01),
    waitUntil: String(options.waitUntil || "domcontentloaded"),
    sitemaps: String(options.sitemaps || "/sitemap.xml,/sitemap_index.xml"),
    viewports: String(options.viewports || "desktop:1440x900,tablet:768x1024,mobile:390x844"),
  };
}

function numberOrDefault(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueId(name: string, presets: VisualPreset[]): string {
  const usedIds = new Set(presets.map((preset) => preset.id));
  const base = slugify(name) || "preset";
  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
