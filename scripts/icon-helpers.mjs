import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const PNG_SIGNATURE = '89504e470d0a1a0a'

export async function ensureIcoFromPng(pngPath, icoPath) {
  const pngBuffer = await readFile(pngPath)

  if (pngBuffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
    throw new Error(`Expected a PNG source for ICO generation: ${pngPath}`)
  }

  const icoBuffer = createIcoFromPng(pngBuffer)
  await mkdir(dirname(icoPath), { recursive: true })
  await writeFile(icoPath, icoBuffer)
}

export function createIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(0, 6)
  header.writeUInt8(0, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(pngBuffer.length, 14)
  header.writeUInt32LE(22, 18)

  return Buffer.concat([header, pngBuffer])
}
