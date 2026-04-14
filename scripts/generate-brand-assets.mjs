import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureIcoFromPng } from './icon-helpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const brandSvgPath = join(rootDir, 'modai', 'src', 'web', 'static', 'brand-mark.svg')
const iconsDir = join(rootDir, 'src-tauri', 'icons')
const iconsetDir = '/tmp/modai.iconset'
const iconPngPath = join(iconsDir, 'icon.png')
const iconIcoPath = join(iconsDir, 'icon.ico')
const iconIcnsPath = join(iconsDir, 'modAI.icns')
const tempIcnsPath = '/tmp/modAI.icns'

const brandSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="14" y1="10" x2="115" y2="118" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0B1023"/>
      <stop offset="0.55" stop-color="#13234B"/>
      <stop offset="1" stop-color="#350D40"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(94 26) rotate(134.804) scale(83.9878)">
      <stop stop-color="#49FFF2" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#49FFF2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(38 104) rotate(-42.315) scale(62.1182)">
      <stop stop-color="#FF50D8" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#FF50D8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="6" y="6" width="116" height="116" rx="28" fill="url(#bg)"/>
  <rect x="6.75" y="6.75" width="114.5" height="114.5" rx="27.25" stroke="#55FFF2" stroke-opacity="0.28" stroke-width="1.5"/>
  <circle cx="94" cy="26" r="34" fill="url(#glow)"/>
  <circle cx="38" cy="104" r="26" fill="url(#glow2)"/>
  <path d="M32 84V48.735C32 43.9087 35.8937 40 40.6994 40H45.3836C49.016 40 52.324 41.9992 53.9952 45.1966L59.5 55.7225L65.0048 45.1966C66.676 41.9992 69.984 40 73.6164 40H78.3006C83.1063 40 87 43.9087 87 48.735V84H76.5876V55.6683L68.2967 72.3228H50.7033L42.4124 55.6683V84H32Z" fill="#EEF8FF"/>
  <circle cx="92" cy="38" r="7" fill="#4BFFF0"/>
</svg>
`

const iconSwift = `
import Foundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
  fputs("icon render requires outputPath and size\\n", stderr)
  exit(2)
}

let outputPath = args[1]
let size = CGFloat(Double(args[2]) ?? 1024)
let canvas = NSImage(size: NSSize(width: size, height: size))

canvas.lockFocus()
guard let context = NSGraphicsContext.current else {
  fputs("Unable to create graphics context\\n", stderr)
  exit(3)
}

context.imageInterpolation = .high
let rect = NSRect(x: 0, y: 0, width: size, height: size)

let background = NSBezierPath(roundedRect: rect.insetBy(dx: size * 0.03, dy: size * 0.03), xRadius: size * 0.22, yRadius: size * 0.22)
let gradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.04, green: 0.07, blue: 0.16, alpha: 1),
  NSColor(calibratedRed: 0.08, green: 0.13, blue: 0.29, alpha: 1),
  NSColor(calibratedRed: 0.23, green: 0.05, blue: 0.28, alpha: 1),
])!
gradient.draw(in: background, angle: -45)

NSColor(calibratedRed: 0.29, green: 0.98, blue: 0.95, alpha: 0.24).setStroke()
background.lineWidth = size * 0.012
background.stroke()

let glow = NSBezierPath(ovalIn: NSRect(x: size * 0.55, y: size * 0.62, width: size * 0.36, height: size * 0.36))
NSColor(calibratedRed: 0.29, green: 0.98, blue: 0.95, alpha: 0.16).setFill()
glow.fill()

let glow2 = NSBezierPath(ovalIn: NSRect(x: size * 0.10, y: size * 0.04, width: size * 0.28, height: size * 0.28))
NSColor(calibratedRed: 1.0, green: 0.31, blue: 0.85, alpha: 0.11).setFill()
glow2.fill()

let attrs: [NSAttributedString.Key: Any] = [
  .font: NSFont.systemFont(ofSize: size * 0.54, weight: .black),
  .foregroundColor: NSColor(calibratedRed: 0.93, green: 0.97, blue: 1.0, alpha: 1),
]
let glyph = NSString(string: "m")
let glyphSize = glyph.size(withAttributes: attrs)
let glyphRect = NSRect(
  x: (size - glyphSize.width) / 2,
  y: size * 0.23,
  width: glyphSize.width,
  height: glyphSize.height
)
glyph.draw(in: glyphRect, withAttributes: attrs)

let dotRect = NSRect(x: size * 0.68, y: size * 0.64, width: size * 0.10, height: size * 0.10)
let dot = NSBezierPath(ovalIn: dotRect)
NSColor(calibratedRed: 0.29, green: 0.98, blue: 0.95, alpha: 1).setFill()
dot.fill()

canvas.unlockFocus()

guard
  let tiff = canvas.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let pngData = bitmap.representation(using: .png, properties: [:])
else {
  fputs("Failed to encode PNG\\n", stderr)
  exit(4)
}

try pngData.write(to: URL(fileURLWithPath: outputPath))
`

await mkdir(dirname(brandSvgPath), { recursive: true })
await writeFile(brandSvgPath, brandSvg, 'utf8')

await rm(iconsetDir, { recursive: true, force: true })
await rm(tempIcnsPath, { force: true })
renderPng(iconPngPath, 1024)
await ensureIcoFromPng(iconPngPath, iconIcoPath)
if (!await exists(iconIcnsPath)) {
  try {
    buildIconSet(iconPngPath, iconsetDir, tempIcnsPath)
    await cp(tempIcnsPath, iconIcnsPath)
  } catch {
    console.warn(`ICNS generation skipped. Reusing existing ${iconIcnsPath} if present.`)
  }
}

console.log(`Generated ${brandSvgPath}`)
console.log(`Generated ${iconPngPath}`)
console.log(`Generated ${iconIcoPath}`)
console.log(`Prepared ${iconIcnsPath}`)

function renderPng(outputPath, size) {
  execFileSync('swift', ['-', outputPath, String(size)], {
    cwd: rootDir,
    input: iconSwift,
    stdio: ['pipe', 'ignore', 'inherit'],
    env: {
      ...process.env,
      HOME: '/tmp',
      SWIFT_MODULECACHE_PATH: process.env.SWIFT_MODULECACHE_PATH ?? '/tmp/modai-swift-cache',
      CLANG_MODULE_CACHE_PATH: process.env.CLANG_MODULE_CACHE_PATH ?? '/tmp/modai-swift-cache',
    },
  })
}

function buildIconSet(sourcePath, outputDir, icnsPath) {
  const shellScript = [
    `rm -rf "${outputDir}" "${icnsPath}"`,
    `mkdir -p "${outputDir}"`,
    `sips -z 16 16 "${sourcePath}" --out "${join(outputDir, 'icon_16x16.png')}" >/dev/null`,
    `sips -z 32 32 "${sourcePath}" --out "${join(outputDir, 'icon_16x16@2x.png')}" >/dev/null`,
    `sips -z 32 32 "${sourcePath}" --out "${join(outputDir, 'icon_32x32.png')}" >/dev/null`,
    `sips -z 64 64 "${sourcePath}" --out "${join(outputDir, 'icon_32x32@2x.png')}" >/dev/null`,
    `sips -z 128 128 "${sourcePath}" --out "${join(outputDir, 'icon_128x128.png')}" >/dev/null`,
    `sips -z 256 256 "${sourcePath}" --out "${join(outputDir, 'icon_128x128@2x.png')}" >/dev/null`,
    `sips -z 256 256 "${sourcePath}" --out "${join(outputDir, 'icon_256x256.png')}" >/dev/null`,
    `sips -z 512 512 "${sourcePath}" --out "${join(outputDir, 'icon_256x256@2x.png')}" >/dev/null`,
    `sips -z 512 512 "${sourcePath}" --out "${join(outputDir, 'icon_512x512.png')}" >/dev/null`,
    `cp "${sourcePath}" "${join(outputDir, 'icon_512x512@2x.png')}"`,
    `iconutil --convert icns --output "${icnsPath}" "${outputDir}"`,
  ].join(' && ')

  execFileSync('/bin/zsh', ['-lc', shellScript], {
    cwd: rootDir,
    stdio: 'ignore',
  })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    return true
  }
}
