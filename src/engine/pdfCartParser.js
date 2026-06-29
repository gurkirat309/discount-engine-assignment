import * as pdfjsLib from 'pdfjs-dist'
import { parseLines } from './pdfLineParser.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString()

// Re-export parseLines so existing imports still work
export { parseLines }

/**
 * Parses a PDF file (as ArrayBuffer) and extracts CartItem objects.
 *
 * @param {ArrayBuffer} pdfArrayBuffer - The raw PDF data
 * @returns {Promise<Object>} { items: CartItem[], warnings: string[] }
 */
export async function parseCartPDF(pdfArrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1) // Parse the first page
  const textContent = await page.getTextContent()

  // Group items by Y coordinate (vertical position)
  const rows = {}
  for (const item of textContent.items) {
    if (!item.str.trim()) continue
    const y = Math.round(item.transform[5])
    // Find if we already have a row near this Y coordinate (tolerance of 3 pixels)
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

  // Sort rows by Y descending (PDF coordinates start from bottom, so higher Y is top of page)
  const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a)
  
  const lines = sortedY.map(y => {
    // Sort items in the same row by X coordinate (left to right)
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
        
        // If the gap is significant (e.g. > 8 pixels), insert multiple spaces to denote a column change.
        // Otherwise, insert a single space.
        if (gap > 8) {
          lineStr += '   ' + item.str
        } else {
          lineStr += (gap > 1 ? ' ' : '') + item.str
        }
      }
    })
    return lineStr
  })

  return parseLines(lines)
}
