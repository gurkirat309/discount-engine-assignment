import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

const outputDir = path.resolve('sample-data')

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// 1. Well-formed PDF
const doc1 = new PDFDocument()
doc1.pipe(fs.createWriteStream(path.join(outputDir, 'cart_well_formed.pdf')))
doc1.font('Courier').fontSize(10)
doc1.text('Order #OP-9921 | Date: 15 Jan 2025')
doc1.text('Product          Brand          Platform        Base Price')
doc1.text('─────────────────────────────────────────────────────────')
doc1.text('Cushion Cover     Natura Casa    Amazon India    Rs.1,299')
doc1.text('Bed Sheet Set     Natura Casa    Flipkart        Rs.849')
doc1.text('Wall Shelf        LivSpace Pro   Amazon India    Rs.599')
doc1.text('Ceramic Vase      LivSpace Pro   Noon            Rs.2,499')
doc1.text('Cutting Board     Nordic Basics  Amazon India    Rs.449')
doc1.text('Desk Organiser    Nordic Basics  Flipkart        Rs.899')
doc1.end()

// 2. Malformed PDF (one row has TBD instead of price)
const doc2 = new PDFDocument()
doc2.pipe(fs.createWriteStream(path.join(outputDir, 'cart_malformed.pdf')))
doc2.font('Courier').fontSize(10)
doc2.text('Order #OP-9921 | Date: 15 Jan 2025')
doc2.text('Product          Brand          Platform        Base Price')
doc2.text('─────────────────────────────────────────────────────────')
doc2.text('Cushion Cover     Natura Casa    Amazon India    Rs.1,299')
doc2.text('Bed Sheet Set     Natura Casa    Flipkart        Rs.849')
doc2.text('Wall Shelf        LivSpace Pro   Amazon India    Rs.599')
doc2.text('Ceramic Vase      LivSpace Pro   Noon            TBD') // Malformed price
doc2.text('Cutting Board     Nordic Basics  Amazon India    Rs.449')
doc2.text('Desk Organiser    Nordic Basics  Flipkart        Rs.899')
doc2.end()

// 3. Unrelated PDF (no table)
const doc3 = new PDFDocument()
doc3.pipe(fs.createWriteStream(path.join(outputDir, 'cart_unrelated.pdf')))
doc3.font('Helvetica').fontSize(12)
doc3.text('This is a completely unrelated document.')
doc3.text('It contains some paragraphs of text but no tables or pricing information.')
doc3.text('Therefore, the parser should not find any valid items.')
doc3.end()

console.log('PDFs generated successfully in sample-data/')
