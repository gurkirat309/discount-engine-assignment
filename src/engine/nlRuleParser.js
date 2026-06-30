/**
 * nlRuleParser.js
 *
 * Frontend parser and validator for Natural Language rules.
 * Communicates with the server-side Groq proxy.
 */

/**
 * Sends the user's plain text to the local proxy to be parsed by Groq.
 *
 * @param {string} text - Plain English description of the rule
 * @returns {Promise<string>} The raw text response from the LLM
 */
export async function parseRuleWithLLM(text) {
  const response = await fetch('/api/parse-rule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  // Read as text first so we can handle non-JSON responses gracefully
  const rawText = await response.text()

  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    // The server returned non-JSON (e.g. Vercel's HTML error page)
    console.error('Non-JSON response from /api/parse-rule:', rawText.slice(0, 200))
    throw new Error(
      'The server returned an unexpected response. Please ensure GROQ_API_KEY is set in your Vercel Environment Variables (Settings → Environment Variables).'
    )
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to parse rule')
  }

  return data.result
}

/**
 * Strips markdown code fences (e.g. ```json ... ```) if present.
 */
function cleanJsonResponse(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, '')
    cleaned = cleaned.replace(/\n?```$/, '')
  }
  return cleaned.trim()
}

/**
 * Validates a parsed rule object against the DiscountRule schema.
 *
 * @param {Object} ruleObj - The raw parsed JSON object from the LLM
 * @returns {Object} { valid: boolean, rule?: Object, error?: string }
 */
export function validateParsedRule(ruleText) {
  let ruleObj
  try {
    const cleaned = cleanJsonResponse(ruleText)
    ruleObj = JSON.parse(cleaned)
  } catch (err) {
    return { valid: false, error: 'Response is not valid JSON. Please try again with a clearer description.' }
  }

  if (!ruleObj || typeof ruleObj !== 'object') {
    return { valid: false, error: 'Response is not a valid JSON object.' }
  }

  if (ruleObj.error === 'unresolvable') {
    return { valid: false, error: ruleObj.message || 'Rule is ambiguous or incomplete.' }
  }

  const scope = ruleObj.scope
  if (scope !== 'brand' && scope !== 'platform' && scope !== 'cart') {
    return { valid: false, error: 'Scope must be "brand", "platform", or "cart".' }
  }

  const type = ruleObj.type
  if (type !== 'percentage' && type !== 'flat') {
    return { valid: false, error: 'Type must be "percentage" or "flat".' }
  }

  const value = parseFloat(ruleObj.value)
  if (isNaN(value) || value <= 0) {
    return { valid: false, error: 'Value must be a positive number.' }
  }

  if (scope !== 'cart' && (!ruleObj.applies_to || ruleObj.applies_to.trim() === '')) {
    return { valid: false, error: `Applies To is required for "${scope}" scope.` }
  }

  let minCartValue = 0
  if (scope === 'cart') {
    if (ruleObj.min_cart_value === undefined || ruleObj.min_cart_value === '') {
      return { valid: false, error: 'min_cart_value is required for cart scope.' }
    }
    minCartValue = parseFloat(ruleObj.min_cart_value)
    if (isNaN(minCartValue) || minCartValue <= 0) {
      return { valid: false, error: 'min_cart_value must be a positive number.' }
    }
  }

  return {
    valid: true,
    rule: {
      ruleId: `RULE-NL-${Date.now().toString().slice(-4)}`,
      scope,
      appliesTo: scope === 'cart' ? '' : ruleObj.applies_to.trim(),
      type,
      value,
      stackable: !!ruleObj.stackable,
      minCartValue: scope === 'cart' ? minCartValue : 0,
    },
  }
}

/**
 * Validates form-edited rule fields against the DiscountRule schema.
 * Same logic as validateParsedRule, but accepts a structured object
 * from the editable confirmation form instead of raw LLM JSON text.
 *
 * @param {{ scope: string, appliesTo: string, type: string, value: any, stackable: boolean, minCartValue: any }} fields
 * @returns {{ valid: boolean, rule?: Object, error?: string }}
 */
export function validateRuleFields(fields) {
  const { scope, appliesTo, type, value, stackable, minCartValue } = fields

  if (scope !== 'brand' && scope !== 'platform' && scope !== 'cart') {
    return { valid: false, error: 'Scope must be "brand", "platform", or "cart".' }
  }

  if (type !== 'percentage' && type !== 'flat') {
    return { valid: false, error: 'Type must be "percentage" or "flat".' }
  }

  const numValue = parseFloat(value)
  if (isNaN(numValue) || numValue <= 0) {
    return { valid: false, error: 'Value must be a positive number.' }
  }

  if (scope !== 'cart' && (!appliesTo || appliesTo.trim() === '')) {
    return { valid: false, error: `Applies To is required for "${scope}" scope.` }
  }

  let numMinCart = 0
  if (scope === 'cart') {
    if (minCartValue === undefined || minCartValue === '') {
      return { valid: false, error: 'Min Cart Value is required for cart scope.' }
    }
    numMinCart = parseFloat(minCartValue)
    if (isNaN(numMinCart) || numMinCart <= 0) {
      return { valid: false, error: 'Min Cart Value must be a positive number.' }
    }
  }

  return {
    valid: true,
    rule: {
      ruleId: `RULE-NL-${Date.now().toString().slice(-4)}`,
      scope,
      appliesTo: scope === 'cart' ? '' : appliesTo.trim(),
      type,
      value: numValue,
      stackable: !!stackable,
      minCartValue: scope === 'cart' ? numMinCart : 0,
    },
  }
}
