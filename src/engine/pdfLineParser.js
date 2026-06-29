/**
 * Pure-JS line-parsing logic for cart PDFs.
 * No external dependencies — safe to import in both browser and Node.
 *
 * @param {string[]} lines - Array of reconstructed text lines from the PDF
 * @returns {{ items: import('./pdfCartParser.js').CartItem[], warnings: string[] }}
 */
export function parseLines(lines) {
  const items = []
  const warnings = []
  let validRowsCount = 0

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmed = line.trim()

    // Skip empty lines, headers, metadata, and divider lines
    if (!trimmed) return
    if (trimmed.toLowerCase().includes('order #') || trimmed.toLowerCase().includes('date:')) return
    if (trimmed.toLowerCase().includes('product') && trimmed.toLowerCase().includes('brand')) return
    if (/^[─\-_=\s\u2500-\u257F]+$/.test(trimmed)) return // separator lines
    if (!/[a-zA-Z0-9]/.test(trimmed)) return // lines with no alphanumeric content (decorative/separator)

    // Find price at the end of the line
    // Matches "Rs. 1,299", "Rs.1,299", "1299", "1,299", etc.
    const priceMatch = trimmed.match(/(?:Rs\.?\s*)?([\d,]+)\s*$/i)
    if (!priceMatch) {
      warnings.push(`Row ${lineNum}: Could not parse Base Price (expected number at the end), got "${trimmed}"`)
      return
    }

    const priceStr = priceMatch[1]
    const basePrice = parseFloat(priceStr.replace(/,/g, ''))
    if (isNaN(basePrice) || basePrice <= 0) {
      warnings.push(`Row ${lineNum}: Base Price must be a positive number, got "${priceStr}"`)
      return
    }

    // Remove the price part from the line to parse the rest
    const restOfLine = trimmed.substring(0, priceMatch.index).trim()

    // Split the rest by 2 or more spaces to separate columns
    const columns = restOfLine.split(/\s{2,}/)

    if (columns.length !== 3) {
      warnings.push(`Row ${lineNum}: Expected Product, Brand, and Platform columns, but got ${columns.length} columns: "${restOfLine}"`)
      return
    }

    const [product, brand, platform] = columns.map(c => c.trim())

    if (!product || !brand || !platform) {
      warnings.push(`Row ${lineNum}: Missing Product, Brand, or Platform in "${restOfLine}"`)
      return
    }

    validRowsCount++
    items.push({
      itemId: `ITEM-${String(validRowsCount).padStart(2, '0')}`,
      product,
      brand,
      platform,
      basePrice
    })
  })

  return { items, warnings }
}
