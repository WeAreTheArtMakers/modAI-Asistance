#!/usr/bin/env node

import { ModAIApp } from './core/ModAIApp.mjs'

const app = new ModAIApp()

app.run(process.argv.slice(2)).catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`modAI error: ${message}`)
  process.exitCode = 1
})
