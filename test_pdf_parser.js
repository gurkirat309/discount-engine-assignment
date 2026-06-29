/**
 * Node.js test for PDF cart parsing.
 *
 * Uses pdfjs-dist legacy CJS build (via createRequire) to extract text,
 * then feeds lines through the pure-JS parseLines() function.
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { parseLines } from './src/engine/pdfLineParser.js'

const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

/**
 * Extract text lines from a PDF using pdfjs-dist in Node.
 * Reconstructs lines using the same Y-coordinate grouping + X-gap logic
 * as pdfCartParser.js.
 */
async function extractLines(filePath) {
  const buffer = fs.readFileSync(path.resolve(filePath))
  const uint8 = new Uint8Array(buffer)
  const loadingTask = pdfjsLib.getDocument({ data: uint8, disableWorker: true })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const textContent = await page.getTextContent()

  // Group items by Y coordinate (same logic as pdfCartParser.js)
  const rows = {}
  for (const item of textContent.items) {
    if (!item.str.trim()) continue
    const y = Math.round(item.transform[5])
    let foundY = null
    for (const existingY of Object.keys(rows)) {
      if (Math.abs(Number(existingY) - y) <= 3) {
        foundY = existingY
        break
      }
    }
    if (foundY !== null) {
      rows[foundY].push(item)
    } else {
      rows[y] = [item]
    }
  }

  const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a)

  return sortedY.map(y => {
    const items = rows[y].sort((a, b) => a.transform[4] - b.transform[4])
    let lineStr = ''
    items.forEach((item, idx) => {
      if (idx === 0) {
        lineStr += item.str
      } else {
        const prevItem = items[idx - 1]
        const prevXEnd = prevItem.transform[4] + (prevItem.width || 0)
        const currX = item.transform[4]
        const gap = currX - prevXEnd
        if (gap > 8) {
          lineStr += '   ' + item.str
        } else {
          lineStr += (gap > 1 ? ' ' : '') + item.str
        }
      }
    })
    return lineStr
  })
}

async function runTests() {
  let passed = 0
  let failed = 0

  function assert(cond, msg) {
    if (cond) { passed++; console.log(`  ✓ ${msg}`) }
    else      { failed++; console.error(`  ✗ ${msg}`) }
  }

  // ── Test 1: Well-formed PDF ──
  console.log('\n--- Test 1: Well-formed PDF (cart_well_formed.pdf) ---')
  const lines1 = await extractLines('sample-data/cart_well_formed.pdf')
  console.log('  Reconstructed lines:')
  lines1.forEach((l, i) => console.log(`    [${i}] "${l}"`))
  const res1 = parseLines(lines1)
  console.log(`  Extracted ${res1.items.length} items`)
  res1.items.forEach(it => console.log(`    ${it.itemId}: ${it.product} | ${it.brand} | ${it.platform} | Rs.${it.basePrice}`))
  console.log('  Warnings:', res1.warnings)
  assert(res1.items.length === 6, `Expected 6 items, got ${res1.items.length}`)
  assert(res1.warnings.length === 0, `Expected 0 warnings, got ${res1.warnings.length}`)
  if (res1.items.length >= 1) {
    assert(res1.items[0].itemId === 'ITEM-01', `First item ID = ITEM-01, got ${res1.items[0].itemId}`)
    assert(res1.items[0].basePrice > 0, `First item basePrice > 0, got ${res1.items[0].basePrice}`)
  }

  // ── Test 2: Malformed PDF ──
  console.log('\n--- Test 2: Malformed PDF (cart_malformed.pdf) ---')
  const lines2 = await extractLines('sample-data/cart_malformed.pdf')
  console.log('  Reconstructed lines:')
  lines2.forEach((l, i) => console.log(`    [${i}] "${l}"`))
  const res2 = parseLines(lines2)
  console.log(`  Extracted ${res2.items.length} items`)
  console.log('  Warnings:', res2.warnings)
  assert(res2.items.length === 5, `Expected 5 items, got ${res2.items.length}`)
  assert(res2.warnings.length >= 1, `Expected ≥1 warning, got ${res2.warnings.length}`)

  // ── Test 3: Unrelated PDF ──
  console.log('\n--- Test 3: Unrelated PDF (cart_unrelated.pdf) ---')
  const lines3 = await extractLines('sample-data/cart_unrelated.pdf')
  console.log('  Reconstructed lines:')
  lines3.forEach((l, i) => console.log(`    [${i}] "${l}"`))
  const res3 = parseLines(lines3)
  console.log(`  Extracted ${res3.items.length} items`)
  console.log('  Warnings:', res3.warnings)
  assert(res3.items.length === 0, `Expected 0 items, got ${res3.items.length}`)

  // ── Summary ──
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('Test run failed:', err)
  process.exit(1)
})
