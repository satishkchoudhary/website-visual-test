import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

interface ZipEntry {
  name: string;
  data: Buffer;
}

interface CentralDirectoryRecord {
  buffer: Buffer;
  offset: number;
}

export interface ExportBundle {
  fileName: string;
  buffer: Buffer;
}

const crcTable = createCrcTable();

export async function exportLatestReport(resultsRoot = path.resolve("visual-test-results")): Promise<ExportBundle> {
  const runDir = await realpath(path.join(resultsRoot, "latest"));
  return exportRunReport(runDir, resultsRoot);
}

export async function exportRunReport(runDir: string, resultsRoot = path.resolve("visual-test-results")): Promise<ExportBundle> {
  const resolvedRoot = path.resolve(resultsRoot);
  const resolvedRunDir = path.resolve(runDir);
  if (!resolvedRunDir.startsWith(resolvedRoot)) throw new Error("Run folder is outside the results directory.");

  const files = await collectFiles(resolvedRunDir, resolvedRunDir);
  if (!files.length) throw new Error("No report files found to export.");

  const runName = path.basename(resolvedRunDir);
  return {
    fileName: `visual-report-${runName}.zip`,
    buffer: buildZip(files.map((file) => ({
      name: `${runName}/${file.name}`,
      data: file.data,
    }))),
  };
}

async function collectFiles(rootDir: string, currentDir: string): Promise<ZipEntry[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: ZipEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootDir, fullPath));
      continue;
    }
    if (!entry.isFile()) continue;

    const fileStat = await stat(fullPath);
    if (!fileStat.size) continue;

    files.push({
      name: path.relative(rootDir, fullPath).split(path.sep).join("/"),
      data: await readFile(fullPath),
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralRecords: CentralDirectoryRecord[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(10, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, entry.data);
    centralRecords.push({
      buffer: centralDirectoryHeader(entry, name, crc, offset),
      offset,
    });
    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralParts = centralRecords.map((record) => record.buffer);
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function centralDirectoryHeader(entry: ZipEntry, name: Buffer, crc: number, offset: number): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(10, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable(): number[] {
  const table: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}
