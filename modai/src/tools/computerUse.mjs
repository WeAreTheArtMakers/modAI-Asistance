import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

export function createComputerUseTools() {
  return [
    {
      name: 'screen_analyze',
      description: 'Capture or inspect the current screen and return OCR regions with coordinates',
      inputHint: '{"query":"Save","capture":true}',
      permissionKey: 'screen_analyze',
      requiredMode: 'pro',
      async run(input, context) {
        return captureAndAnalyzeScreen(input, context)
      },
    },
    {
      name: 'click_text',
      description: 'Find visible text on screen and click the center of the matched region',
      inputHint: '{"query":"Continue","matchIndex":0}',
      permissionKey: 'click_text',
      requiredMode: 'pro',
      async run(input, context) {
        const options = readClickTextInput(input)
        if (!options.query) {
          throw new Error('Usage: click_text {"query":"Continue","matchIndex":0}')
        }

        const analysis = await captureAndAnalyzeScreen({
          path: options.path,
          query: options.query,
          capture: options.capture,
        }, context)
        const match = analysis.matches?.[options.matchIndex] ?? null
        if (!match) {
          throw new Error(`No screen text matched "${options.query}"`)
        }

        await mouseClick({
          x: match.bounds.centerX,
          y: match.bounds.centerY,
          button: options.button,
          clickCount: options.clickCount,
        })

        return {
          clicked: match.text,
          point: {
            x: match.bounds.centerX,
            y: match.bounds.centerY,
          },
          imagePath: analysis.imagePath,
        }
      },
    },
    {
      name: 'mouse_click',
      description: 'Click a screen coordinate on macOS',
      inputHint: '{"x":640,"y":420,"button":"left","clickCount":1}',
      permissionKey: 'mouse_click',
      requiredMode: 'pro',
      async run(input) {
        const point = readMouseClickInput(input)
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          throw new Error('Usage: mouse_click {"x":640,"y":420,"button":"left","clickCount":1}')
        }
        await mouseClick(point)
        return `Clicked ${point.button} at (${point.x}, ${point.y})`
      },
    },
    {
      name: 'mouse_drag',
      description: 'Drag from one screen coordinate to another on macOS',
      inputHint: '{"fromX":640,"fromY":420,"toX":980,"toY":420,"button":"left","durationMs":260}',
      permissionKey: 'mouse_drag',
      requiredMode: 'pro',
      async run(input) {
        const drag = readMouseDragInput(input)
        if (![drag.fromX, drag.fromY, drag.toX, drag.toY].every(Number.isFinite)) {
          throw new Error('Usage: mouse_drag {"fromX":640,"fromY":420,"toX":980,"toY":420,"button":"left","durationMs":260}')
        }
        await mouseDrag(drag)
        return `Dragged ${drag.button} from (${drag.fromX}, ${drag.fromY}) to (${drag.toX}, ${drag.toY})`
      },
    },
    {
      name: 'scroll',
      description: 'Scroll vertically or horizontally on macOS',
      inputHint: '{"deltaY":-420,"deltaX":0,"units":"pixel"}',
      permissionKey: 'scroll',
      requiredMode: 'pro',
      async run(input) {
        const scrollInput = readScrollInput(input)
        if (!Number.isFinite(scrollInput.deltaX) && !Number.isFinite(scrollInput.deltaY)) {
          throw new Error('Usage: scroll {"deltaY":-420,"deltaX":0,"units":"pixel"}')
        }
        await mouseScroll(scrollInput)
        return `Scrolled x=${scrollInput.deltaX} y=${scrollInput.deltaY} (${scrollInput.units})`
      },
    },
    {
      name: 'window_focus',
      description: 'Bring a macOS app or window to the front',
      inputHint: '{"application":"Finder"} or {"query":"Xcode"}',
      permissionKey: 'window_focus',
      requiredMode: 'pro',
      async run(input) {
        const target = readWindowFocusInput(input)
        if (!target.application && !target.query) {
          throw new Error('Usage: window_focus {"application":"Finder"} or {"query":"Xcode"}')
        }
        const result = await focusWindow(target)
        return result || `Focused ${target.application || target.query}`
      },
    },
    {
      name: 'type_text',
      description: 'Type text into the focused macOS control',
      inputHint: '{"text":"hello world"}',
      permissionKey: 'type_text',
      requiredMode: 'pro',
      async run(input) {
        const text = readTextInput(input)
        if (!text) {
          throw new Error('Usage: type_text {"text":"hello world"}')
        }
        const script = `tell application "System Events" to keystroke "${escapeAppleScriptString(text)}"`
        await runProcess('osascript', ['-e', script])
        return `Typed ${text.length} character(s)`
      },
    },
    {
      name: 'press_key',
      description: 'Press a key or shortcut on macOS',
      inputHint: '{"key":"k","modifiers":["command"]}',
      permissionKey: 'press_key',
      requiredMode: 'pro',
      async run(input) {
        const keyPress = readKeyPressInput(input)
        if (!keyPress.key) {
          throw new Error('Usage: press_key {"key":"return"} or {"key":"k","modifiers":["command"]}')
        }
        await runProcess('osascript', ['-e', createKeyPressAppleScript(keyPress)])
        return `Pressed ${formatKeyCombo(keyPress)}`
      },
    },
  ]
}

async function captureAndAnalyzeScreen(input, context) {
  const options = readScreenAnalyzeInput(input)
  const targetPath = options.path
    ? resolve(options.path)
    : await createArtifactPath(context, 'screenshots', `screen-${randomUUID()}.png`)

  if (options.capture !== false || !options.path) {
    await runProcess('screencapture', ['-x', targetPath])
  }

  const raw = await runSwiftScript(SCREEN_ANALYZE_SWIFT, [targetPath, options.query ?? ''])
  return JSON.parse(raw)
}

async function mouseClick({ x, y, button = 'left', clickCount = 1 }) {
  await runSwiftScript(MOUSE_CLICK_SWIFT, [
    String(Math.round(x)),
    String(Math.round(y)),
    normalizeMouseButton(button),
    String(normalizeClickCount(clickCount)),
  ])
}

async function mouseDrag({ fromX, fromY, toX, toY, button = 'left', durationMs = 260 }) {
  await runSwiftScript(MOUSE_DRAG_SWIFT, [
    String(Math.round(fromX)),
    String(Math.round(fromY)),
    String(Math.round(toX)),
    String(Math.round(toY)),
    normalizeMouseButton(button),
    String(normalizeDuration(durationMs)),
  ])
}

async function mouseScroll({ deltaX = 0, deltaY = -420, units = 'pixel' }) {
  await runSwiftScript(MOUSE_SCROLL_SWIFT, [
    String(Math.round(deltaX)),
    String(Math.round(deltaY)),
    normalizeScrollUnits(units),
  ])
}

async function focusWindow({ application = '', query = '' }) {
  if (application) {
    const script = `tell application "${escapeAppleScriptString(application)}" to activate`
    await runProcess('osascript', ['-e', script])
    return `Focused ${application}`
  }

  const script = createWindowFocusAppleScript(query)
  const result = await runProcess('osascript', ['-e', script])
  return result || `Focused window matching "${query}"`
}

function readScreenAnalyzeInput(input) {
  if (typeof input === 'string') {
    return {
      query: input.trim(),
      capture: true,
      path: '',
    }
  }

  if (input && typeof input === 'object') {
    return {
      query: input.query ?? input.text ?? '',
      capture: input.capture !== false,
      path: input.path ?? '',
    }
  }

  return {
    query: '',
    capture: true,
    path: '',
  }
}

function readClickTextInput(input) {
  if (typeof input === 'string') {
    return {
      query: input.trim(),
      matchIndex: 0,
      button: 'left',
      clickCount: 1,
      capture: true,
      path: '',
    }
  }

  if (input && typeof input === 'object') {
    return {
      query: input.query ?? input.text ?? '',
      matchIndex: normalizeIndex(input.matchIndex),
      button: normalizeMouseButton(input.button ?? 'left'),
      clickCount: normalizeClickCount(input.clickCount),
      capture: input.capture !== false,
      path: input.path ?? '',
    }
  }

  return {
    query: '',
    matchIndex: 0,
    button: 'left',
    clickCount: 1,
    capture: true,
    path: '',
  }
}

function readMouseClickInput(input) {
  if (typeof input === 'string') {
    const [x, y, button = 'left', clickCount = '1'] = input.trim().split(/\s+/)
    return {
      x: Number(x),
      y: Number(y),
      button: normalizeMouseButton(button),
      clickCount: normalizeClickCount(clickCount),
    }
  }

  if (input && typeof input === 'object') {
    return {
      x: Number(input.x),
      y: Number(input.y),
      button: normalizeMouseButton(input.button ?? 'left'),
      clickCount: normalizeClickCount(input.clickCount),
    }
  }

  return {
    x: Number.NaN,
    y: Number.NaN,
    button: 'left',
    clickCount: 1,
  }
}

function readMouseDragInput(input) {
  if (typeof input === 'string') {
    const [fromX, fromY, toX, toY, button = 'left', durationMs = '260'] = input.trim().split(/\s+/)
    return {
      fromX: Number(fromX),
      fromY: Number(fromY),
      toX: Number(toX),
      toY: Number(toY),
      button: normalizeMouseButton(button),
      durationMs: normalizeDuration(durationMs),
    }
  }

  if (input && typeof input === 'object') {
    return {
      fromX: Number(input.fromX ?? input.startX ?? input.x1),
      fromY: Number(input.fromY ?? input.startY ?? input.y1),
      toX: Number(input.toX ?? input.endX ?? input.x2),
      toY: Number(input.toY ?? input.endY ?? input.y2),
      button: normalizeMouseButton(input.button ?? 'left'),
      durationMs: normalizeDuration(input.durationMs),
    }
  }

  return {
    fromX: Number.NaN,
    fromY: Number.NaN,
    toX: Number.NaN,
    toY: Number.NaN,
    button: 'left',
    durationMs: 260,
  }
}

function readScrollInput(input) {
  if (typeof input === 'string') {
    const [deltaY = '-420', deltaX = '0', units = 'pixel'] = input.trim().split(/\s+/)
    return {
      deltaX: Number(deltaX),
      deltaY: Number(deltaY),
      units: normalizeScrollUnits(units),
    }
  }

  if (input && typeof input === 'object') {
    return {
      deltaX: Number(input.deltaX ?? 0),
      deltaY: Number(input.deltaY ?? input.amount ?? -420),
      units: normalizeScrollUnits(input.units ?? input.unit ?? 'pixel'),
    }
  }

  return {
    deltaX: 0,
    deltaY: -420,
    units: 'pixel',
  }
}

function readWindowFocusInput(input) {
  if (typeof input === 'string') {
    return {
      application: '',
      query: input.trim(),
    }
  }

  if (input && typeof input === 'object') {
    return {
      application: String(input.application ?? input.app ?? '').trim(),
      query: String(input.query ?? input.title ?? input.window ?? '').trim(),
    }
  }

  return {
    application: '',
    query: '',
  }
}

function readTextInput(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    return input.text ?? input.content ?? ''
  }

  return ''
}

function readKeyPressInput(input) {
  if (typeof input === 'string') {
    const parts = input.split('+').map(part => part.trim()).filter(Boolean)
    if (!parts.length) {
      return { key: '', modifiers: [] }
    }

    return {
      key: parts.at(-1).toLowerCase(),
      modifiers: parts.slice(0, -1).map(normalizeModifier).filter(Boolean),
    }
  }

  if (input && typeof input === 'object') {
    return {
      key: String(input.key ?? input.code ?? '').trim().toLowerCase(),
      modifiers: Array.isArray(input.modifiers) ? input.modifiers.map(normalizeModifier).filter(Boolean) : [],
    }
  }

  return {
    key: '',
    modifiers: [],
  }
}

function createKeyPressAppleScript({ key, modifiers }) {
  const specialKeyCode = SPECIAL_KEY_CODES[key]
  const modifierClause = modifiers.length
    ? ` using {${modifiers.map(modifier => `${modifier} down`).join(', ')}}`
    : ''

  if (Number.isInteger(specialKeyCode)) {
    return `tell application "System Events" to key code ${specialKeyCode}${modifierClause}`
  }

  return `tell application "System Events" to keystroke "${escapeAppleScriptString(key)}"${modifierClause}`
}

function formatKeyCombo({ key, modifiers }) {
  return [...modifiers, key].filter(Boolean).join('+')
}

function normalizeModifier(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'cmd') {
    return 'command'
  }
  if (normalized === 'ctrl') {
    return 'control'
  }
  if (['command', 'control', 'option', 'shift'].includes(normalized)) {
    return normalized
  }
  return ''
}

function normalizeMouseButton(value) {
  const normalized = String(value ?? 'left').trim().toLowerCase()
  return ['left', 'right', 'center'].includes(normalized) ? normalized : 'left'
}

function normalizeClickCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(3, Math.round(parsed))) : 1
}

function normalizeDuration(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(80, Math.min(3_000, Math.round(parsed))) : 260
}

function normalizeIndex(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function normalizeScrollUnits(value) {
  const normalized = String(value ?? 'pixel').trim().toLowerCase()
  return normalized === 'line' ? 'line' : 'pixel'
}

function escapeAppleScriptString(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
}

function createWindowFocusAppleScript(query) {
  return `
set targetQuery to "${escapeAppleScriptString(query)}"
tell application "System Events"
  repeat with targetProcess in application processes
    repeat with targetWindow in windows of targetProcess
      try
        set windowName to name of targetWindow as text
        if windowName contains targetQuery then
          set frontmost of targetProcess to true
          try
            perform action "AXRaise" of targetWindow
          end try
          return name of targetProcess as text
        end if
      end try
    end repeat
  end repeat
end tell
error "No window matched: " & targetQuery
`.trim()
}

async function createArtifactPath(context, folderName, fileName) {
  const baseDir = context?.configStore?.getBaseDir?.() ?? join(process.cwd(), '.modai')
  const targetDir = join(baseDir, folderName)
  await mkdir(targetDir, { recursive: true })
  return join(targetDir, fileName)
}

async function runSwiftScript(source, args = []) {
  return runProcess('swift', ['-', ...args], {
    input: source,
    env: {
      HOME: '/tmp',
      SWIFT_MODULECACHE_PATH: process.env.SWIFT_MODULECACHE_PATH ?? '/tmp/modai-swift-cache',
      CLANG_MODULE_CACHE_PATH: process.env.CLANG_MODULE_CACHE_PATH ?? '/tmp/modai-swift-cache',
    },
  })
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
    })

    const stdout = []
    const stderr = []

    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.on('error', rejectPromise)
    child.on('close', code => {
      const stdoutText = Buffer.concat(stdout).toString('utf8').trim()
      const stderrText = Buffer.concat(stderr).toString('utf8').trim()
      if (code !== 0) {
        rejectPromise(new Error(stderrText || `${command} exited with code ${code}`))
        return
      }
      resolvePromise(stdoutText || stderrText)
    })

    if (options.input) {
      child.stdin.write(options.input)
    }
    child.stdin.end()
  })
}

const SPECIAL_KEY_CODES = {
  return: 36,
  enter: 76,
  tab: 48,
  space: 49,
  escape: 53,
  esc: 53,
  delete: 51,
  backspace: 51,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
}

const MOUSE_CLICK_SWIFT = `
import Foundation
import ApplicationServices
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 5 else {
  fputs("mouse_click requires x y button clickCount\\n", stderr)
  exit(2)
}

guard AXIsProcessTrusted() else {
  fputs("Accessibility permission required for mouse control. Enable modAI in System Settings > Privacy & Security > Accessibility.\\n", stderr)
  exit(3)
}

let x = Double(args[1]) ?? 0
let y = Double(args[2]) ?? 0
let buttonName = args[3]
let clickCount = max(1, Int(args[4]) ?? 1)
let point = CGPoint(x: x, y: y)

let mouseButton: CGMouseButton
let downType: CGEventType
let upType: CGEventType

switch buttonName {
case "right":
  mouseButton = .right
  downType = .rightMouseDown
  upType = .rightMouseUp
case "center":
  mouseButton = .center
  downType = .otherMouseDown
  upType = .otherMouseUp
default:
  mouseButton = .left
  downType = .leftMouseDown
  upType = .leftMouseUp
}

CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: mouseButton)?.post(tap: .cghidEventTap)
usleep(40000)

for index in 0..<clickCount {
  let clickState = Int64(index + 1)
  let downEvent = CGEvent(mouseEventSource: nil, mouseType: downType, mouseCursorPosition: point, mouseButton: mouseButton)
  downEvent?.setIntegerValueField(.mouseEventClickState, value: clickState)
  downEvent?.post(tap: .cghidEventTap)

  let upEvent = CGEvent(mouseEventSource: nil, mouseType: upType, mouseCursorPosition: point, mouseButton: mouseButton)
  upEvent?.setIntegerValueField(.mouseEventClickState, value: clickState)
  upEvent?.post(tap: .cghidEventTap)
  usleep(60000)
}

print("ok")
`

const MOUSE_DRAG_SWIFT = `
import Foundation
import ApplicationServices
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 7 else {
  fputs("mouse_drag requires fromX fromY toX toY button durationMs\\n", stderr)
  exit(2)
}

guard AXIsProcessTrusted() else {
  fputs("Accessibility permission required for mouse control. Enable modAI in System Settings > Privacy & Security > Accessibility.\\n", stderr)
  exit(3)
}

let fromPoint = CGPoint(x: Double(args[1]) ?? 0, y: Double(args[2]) ?? 0)
let toPoint = CGPoint(x: Double(args[3]) ?? 0, y: Double(args[4]) ?? 0)
let buttonName = args[5]
let durationMs = max(80, Int(args[6]) ?? 260)

let mouseButton: CGMouseButton
let downType: CGEventType
let dragType: CGEventType
let upType: CGEventType

switch buttonName {
case "right":
  mouseButton = .right
  downType = .rightMouseDown
  dragType = .rightMouseDragged
  upType = .rightMouseUp
case "center":
  mouseButton = .center
  downType = .otherMouseDown
  dragType = .otherMouseDragged
  upType = .otherMouseUp
default:
  mouseButton = .left
  downType = .leftMouseDown
  dragType = .leftMouseDragged
  upType = .leftMouseUp
}

CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: fromPoint, mouseButton: mouseButton)?.post(tap: .cghidEventTap)
usleep(50000)
CGEvent(mouseEventSource: nil, mouseType: downType, mouseCursorPosition: fromPoint, mouseButton: mouseButton)?.post(tap: .cghidEventTap)

let steps = max(10, min(80, durationMs / 12))
let pauseMicros = useconds_t(max(6_000, (durationMs * 1_000) / max(1, steps)))
for step in 1...steps {
  let progress = CGFloat(step) / CGFloat(steps)
  let point = CGPoint(
    x: fromPoint.x + ((toPoint.x - fromPoint.x) * progress),
    y: fromPoint.y + ((toPoint.y - fromPoint.y) * progress)
  )
  CGEvent(mouseEventSource: nil, mouseType: dragType, mouseCursorPosition: point, mouseButton: mouseButton)?.post(tap: .cghidEventTap)
  usleep(pauseMicros)
}

CGEvent(mouseEventSource: nil, mouseType: upType, mouseCursorPosition: toPoint, mouseButton: mouseButton)?.post(tap: .cghidEventTap)
print("ok")
`

const MOUSE_SCROLL_SWIFT = `
import Foundation
import ApplicationServices
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 4 else {
  fputs("scroll requires deltaX deltaY units\\n", stderr)
  exit(2)
}

guard AXIsProcessTrusted() else {
  fputs("Accessibility permission required for scroll control. Enable modAI in System Settings > Privacy & Security > Accessibility.\\n", stderr)
  exit(3)
}

let deltaX = Int32(Double(args[1]) ?? 0)
let deltaY = Int32(Double(args[2]) ?? 0)
let units = args[3] == "line" ? CGScrollEventUnit.line : CGScrollEventUnit.pixel

guard let event = CGEvent(scrollWheelEvent2Source: nil, units: units, wheelCount: 2, wheel1: deltaY, wheel2: deltaX, wheel3: 0) else {
  fputs("Unable to create scroll event\\n", stderr)
  exit(4)
}

event.post(tap: .cghidEventTap)
print("ok")
`

const SCREEN_ANALYZE_SWIFT = `
import Foundation
import AppKit
import Vision
import ImageIO

let args = CommandLine.arguments
guard args.count >= 2 else {
  fputs("screen_analyze requires an image path\\n", stderr)
  exit(2)
}

let imagePath = args[1]
let query = args.count > 2 ? args[2].lowercased() : ""
let imageURL = URL(fileURLWithPath: imagePath)
guard
  let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
  let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
  let width = properties[kCGImagePropertyPixelWidth] as? Int,
  let height = properties[kCGImagePropertyPixelHeight] as? Int
else {
  fputs("Unable to decode image at \\(imagePath)\\n", stderr)
  exit(3)
}

func boundsPayload(_ box: CGRect) -> [String: Int] {
  let x = Int((box.minX * CGFloat(width)).rounded())
  let y = Int(((1.0 - box.maxY) * CGFloat(height)).rounded())
  let w = Int((box.width * CGFloat(width)).rounded())
  let h = Int((box.height * CGFloat(height)).rounded())
  return [
    "x": x,
    "y": y,
    "width": w,
    "height": h,
    "centerX": x + max(1, w) / 2,
    "centerY": y + max(1, h) / 2
  ]
}

var texts = [[String: Any]]()
var matches = [[String: Any]]()
var rectangles = [[String: Any]]()

let textRequest = VNRecognizeTextRequest { request, error in
  guard error == nil else { return }
  let observations = request.results as? [VNRecognizedTextObservation] ?? []
  for observation in observations.prefix(80) {
    guard let topCandidate = observation.topCandidates(1).first else { continue }
    let payload: [String: Any] = [
      "text": topCandidate.string,
      "confidence": topCandidate.confidence,
      "bounds": boundsPayload(observation.boundingBox),
    ]
    texts.append(payload)
    if !query.isEmpty && topCandidate.string.lowercased().contains(query) {
      matches.append(payload)
    }
  }
}
textRequest.recognitionLevel = .accurate
textRequest.usesLanguageCorrection = true

let rectangleRequest = VNDetectRectanglesRequest { request, error in
  guard error == nil else { return }
  let observations = request.results as? [VNRectangleObservation] ?? []
  for observation in observations.prefix(20) {
    rectangles.append([
      "confidence": observation.confidence,
      "bounds": boundsPayload(observation.boundingBox),
    ])
  }
}
rectangleRequest.maximumObservations = 20
rectangleRequest.minimumConfidence = 0.4
rectangleRequest.minimumAspectRatio = 0.2

let handler = VNImageRequestHandler(url: imageURL, options: [:])
do {
  try handler.perform([textRequest, rectangleRequest])
} catch {
  let fallbackPayload: [String: Any] = [
    "imagePath": imagePath,
    "frontmostApp": NSWorkspace.shared.frontmostApplication?.localizedName ?? "",
    "size": [
      "width": width,
      "height": height,
    ],
    "query": query,
    "matches": [],
    "texts": [],
    "rectangles": [],
    "warning": "Vision analysis failed: \\(error.localizedDescription)",
  ]
  let fallbackData = try JSONSerialization.data(withJSONObject: fallbackPayload, options: [.prettyPrinted])
  if let text = String(data: fallbackData, encoding: .utf8) {
    print(text)
    exit(0)
  }
  exit(5)
}

let frontmostApp = NSWorkspace.shared.frontmostApplication?.localizedName ?? ""
let payload: [String: Any] = [
  "imagePath": imagePath,
  "frontmostApp": frontmostApp,
  "size": [
    "width": width,
    "height": height,
  ],
  "query": query,
  "matches": matches,
  "texts": texts,
  "rectangles": rectangles,
]

let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted])
if let text = String(data: data, encoding: .utf8) {
  print(text)
}
`
