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
