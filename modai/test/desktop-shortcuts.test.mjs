import test from 'node:test'
import assert from 'node:assert/strict'

import { createDesktopShortcut, extractSearchQuery } from '../src/core/desktopShortcuts.mjs'

test('extractSearchQuery parses spaced Turkish provider suffixes', () => {
  assert.equal(
    extractSearchQuery('browserda chorme ac ve youtube da baran güleşen ara', 'youtube'),
    'baran güleşen',
  )

  assert.equal(
    extractSearchQuery("google'da altin fiyatlari ara", 'google'),
    'altin fiyatlari',
  )
})

test('createDesktopShortcut builds a Chrome YouTube shortcut from a natural desktop command', () => {
  const action = createDesktopShortcut('browserda chorme aç ve youtube da baran güleşen ara')
  assert.equal(action.toolName, 'open')
  assert.equal(action.input.application, 'Google Chrome')
  assert.match(action.input.target, /youtube\.com\/results\?search_query=baran%20g%C3%BCle%C5%9Fen/i)
})

test('createDesktopShortcut opens the application when only Chrome launch is requested', () => {
  const action = createDesktopShortcut('chrome ac')
  assert.equal(action.toolName, 'open')
  assert.deepEqual(action.input, { application: 'Google Chrome' })
})

test('createDesktopShortcut derives a YouTube search from structured desktop fields', () => {
  const action = createDesktopShortcut([
    'Bilgisayar kontrolu',
    'Gorev: chrome ac ve YouTube ziyaret et',
    'Amac: Baran Gulesen videolarini bulmak',
    'Kisitlar: yok',
    'Tamamlanma Kriteri: Baran Gulesen YouTube arama sonuclari gorunuyor',
  ].join('\n'))

  assert.equal(action.toolName, 'open')
  assert.equal(action.input.application, 'Google Chrome')
  assert.match(action.input.target, /youtube\.com\/results\?search_query=baran%20gulesen/i)
  assert.doesNotMatch(action.input.target, /arama/i)
})

test('createDesktopShortcut opens Finder Downloads instead of deriving a YouTube query', () => {
  const action = createDesktopShortcut([
    'Gorev: Finder ac ve Downloads klasorunu goster',
    'Amac: indirilen dosyalari kontrol etmek',
    'Kisitlar: Sadece Finder kullan',
    'Tamamlanma Kriteri: Downloads klasoru ekranda acik',
  ].join('\n'))

  assert.equal(action.toolName, 'open')
  assert.equal(action.input.application, 'Finder')
  assert.match(action.input.target, /Downloads$/)
  assert.equal(action.input.target.includes('youtube.com'), false)
})

test('createDesktopShortcut captures a screenshot instead of deriving a YouTube query', () => {
  const action = createDesktopShortcut([
    'Gorev: mevcut ekrandan ekran goruntusu al',
    'Amac: acik pencerenin bir kopyasini kaydetmek',
    'Kisitlar: dosyayi masaustune kaydet',
    'Tamamlanma Kriteri: ekran goruntusu dosyasi olustu',
  ].join('\n'))

  assert.equal(action.toolName, 'screenshot')
  assert.match(action.input.path, /modAI-screenshot-.+\.png$/)
  assert.equal(JSON.stringify(action.input).includes('youtube.com'), false)
})
