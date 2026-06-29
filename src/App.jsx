/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together CSV upload → parse → engine → display.
 */

import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { processCart, cartTotal } from './engine/discountEngine.js'
import { applyCartLevelDiscount } from './engine/cartDiscountEngine.js'
import { parseRuleWithLLM, validateParsedRule } from './engine/nlRuleParser.js'

// ── Column definitions ───────────────────────────────────────────

const RULES_COLUMNS = [
  { key: 'ruleId',    label: 'Rule ID' },
  { key: 'scope',     label: 'Scope',      render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'type',      label: 'Type',       render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  { key: 'stackable', label: 'Stackable',  render: (v) => (v ? 'Yes' : 'No') },
  { key: 'minCartValue', label: 'Min Cart Value', render: (v) => v ? `Rs.${v.toLocaleString('en-IN')}` : '—' },
]

const CART_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'brand',     label: 'Brand' },
  { key: 'platform',  label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
]

const RESULTS_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'basePrice', label: 'Base Price',  render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
  { key: 'finalPrice',label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page:    { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header:  { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan:{ color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main:    { maxWidth: 960, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn:     {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
  tag: (color, bg) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px',
    borderRadius: 20, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  }),
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules]           = useState([])
  const [rulesErrors, setRulesErr]  = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems]   = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName]   = useState('')

  const [results, setResults]       = useState(null)

  const [nlInput, setNlInput]       = useState('')
  const [isParsing, setIsParsing]   = useState(false)
  const [parsedRule, setParsedRule] = useState(null)
  const [parseError, setParseError] = useState(null)

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResults(null) // clear stale results
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setResults(null)
  }

  function handleCalculate() {
    const res = processCart(cartItems, rules)
    setResults(res)
  }

  async function handleParseRule() {
    if (!nlInput.trim()) return
    setIsParsing(true)
    setParseError(null)
    setParsedRule(null)
    try {
      const rawResult = await parseRuleWithLLM(nlInput)
      const validation = validateParsedRule(rawResult)
      if (validation.valid) {
        setParsedRule(validation.rule)
      } else {
        setParseError(validation.error || "Couldn't understand this rule — please specify a value and/or threshold")
      }
    } catch (err) {
      setParseError(err.message || 'An error occurred while parsing the rule.')
    } finally {
      setIsParsing(false)
    }
  }

  function handleConfirmRule() {
    if (!parsedRule) return
    const updatedRules = [...rules, parsedRule]
    setRules(updatedRules)
    setParsedRule(null)
    setNlInput('')

    if (results) {
      const res = processCart(cartItems, updatedRules)
      setResults(res)
    }
  }

  function handleDiscardRule() {
    setParsedRule(null)
    setParseError(null)
    setNlInput('')
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Left Column: Rules & NL Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Rules upload */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Discount Rules</div>
              <CsvUploader
                label="rules.csv"
                description="Upload your discount rules CSV"
                onLoad={handleRulesLoad}
                hasData={rules.length > 0}
                fileName={rulesFileName}
              />
              <ErrorBanner errors={rulesErrors} />
              {rules.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                    {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                  </div>
                  <DataTable columns={RULES_COLUMNS} rows={rules} />
                </div>
              )}
            </div>

            {/* Natural Language Rule Input */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Add Rule via Text</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: '0.6rem' }}>
                Type a plain-English rule (e.g., "20% off for Natura Casa brand, stackable")
              </div>
              <textarea
                style={{
                  width: '100%',
                  height: '60px',
                  borderRadius: 4,
                  border: '1px solid #CECECE',
                  padding: '0.5rem',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  marginBottom: '0.6rem'
                }}
                placeholder="Type a rule..."
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                disabled={isParsing}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  style={nlInput.trim() && !isParsing ? S.btn : S.btnDisabled}
                  onClick={handleParseRule}
                  disabled={!nlInput.trim() || isParsing}
                >
                  {isParsing ? 'Parsing...' : 'Parse Rule'}
                </button>
                {(parsedRule || parseError) && (
                  <button
                    style={{
                      background: '#ccc',
                      color: '#333',
                      border: 'none',
                      borderRadius: 4,
                      padding: '0.4rem 1rem',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={handleDiscardRule}
                  >
                    Clear
                  </button>
                )}
              </div>

              {parseError && (
                <div style={{
                  marginTop: '0.8rem',
                  padding: '0.6rem 0.8rem',
                  background: '#fde8e8',
                  color: '#9b1c1c',
                  borderRadius: 4,
                  fontSize: 12,
                  borderLeft: '4px solid #f05252'
                }}>
                  {parseError}
                </div>
              )}

              {parsedRule && (
                <div style={{
                  marginTop: '0.8rem',
                  padding: '0.8rem',
                  background: '#f3faf7',
                  border: '1px solid #def7ec',
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#03543f', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Parsed Rule Preview
                  </div>
                  <div style={{ fontSize: 13, color: '#1f2937', lineHeight: '1.4', marginBottom: '0.8rem' }}>
                    <strong>Scope:</strong> {parsedRule.scope.toUpperCase()}
                    {parsedRule.scope !== 'cart' && <> · <strong>Applies To:</strong> {parsedRule.appliesTo}</>}
                    <br />
                    <strong>Type:</strong> {parsedRule.type === 'percentage' ? 'Percentage' : 'Flat'} · <strong>Value:</strong> {parsedRule.type === 'percentage' ? `${parsedRule.value}% off` : `Rs.${parsedRule.value} off`}
                    <br />
                    <strong>Stackable:</strong> {parsedRule.stackable ? 'Yes' : 'No'}
                    {parsedRule.scope === 'cart' && <> · <strong>Min Cart Value:</strong> Rs.{parsedRule.minCartValue.toLocaleString('en-IN')}</>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      style={{
                        background: '#0e9f6e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '0.4rem 1rem',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      onClick={handleConfirmRule}
                    >
                      Confirm & Add Rule
                    </button>
                    <button
                      style={{
                        background: '#f05252',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '0.4rem 1rem',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      onClick={handleDiscardRule}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0}
              fileName={cartFileName}
            />
            <ErrorBanner errors={cartErrors} />
            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload both files to calculate
            </div>
          )}
        </div>

        {/* Results */}
        {results && (() => {
          const cartDiscount = applyCartLevelDiscount(results, rules)
          return (
            <div style={S.section}>
              <div style={S.sectionTitle}>Cart Summary</div>
              <DataTable columns={RESULTS_COLUMNS} rows={results} />
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                marginTop: '1rem',
                gap: '0.5rem'
              }}>
                {cartDiscount.cartOfferApplied && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontSize: 13, color: '#555' }}>
                      <span>Subtotal:</span>
                      <span style={{ fontWeight: 600 }}>Rs.{cartDiscount.cartSubtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontSize: 13, color: '#1e5c2c', fontWeight: 600 }}>
                      <span>{cartDiscount.cartOfferLabel}</span>
                    </div>
                  </>
                )}
                <div style={S.totalRow}>
                  <span style={S.totalLabel}>Cart Total</span>
                  <span style={S.totalValue}>Rs.{cartDiscount.finalCartTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
