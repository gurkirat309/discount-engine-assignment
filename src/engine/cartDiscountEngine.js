/**
 * cartDiscountEngine.js
 *
 * Handles cart-level discount calculations.
 * This runs after item-level discounts are calculated.
 */

/**
 * Applies cart-level discount rules to the already-computed item results.
 *
 * @param {Array} items - Array of DiscountResult objects from item-level calculation
 * @param {Array} rules - Array of all DiscountRule objects
 * @returns {Object} { cartSubtotal, cartOfferApplied, cartOfferLabel, amountSaved, finalCartTotal }
 */
export function applyCartLevelDiscount(items, rules) {
  // 1. Sum up the FINAL price of every item (not base price) to get the cart subtotal.
  const cartSubtotal = items.reduce((sum, item) => sum + item.finalPrice, 0)

  // 2. Find any active rule with scope === "cart".
  const cartRules = rules.filter((r) => r.scope === 'cart')

  // If there are no cart rules, return early
  if (cartRules.length === 0) {
    return {
      cartSubtotal,
      cartOfferApplied: false,
      cartOfferLabel: '',
      amountSaved: 0,
      finalCartTotal: cartSubtotal,
    }
  }

  // 3. Filter rules that are eligible (cartSubtotal >= rule.minCartValue)
  const eligibleRules = cartRules.filter(
    (rule) => cartSubtotal >= (rule.minCartValue || 0)
  )

  if (eligibleRules.length === 0) {
    return {
      cartSubtotal,
      cartOfferApplied: false,
      cartOfferLabel: '',
      amountSaved: 0,
      finalCartTotal: cartSubtotal,
    }
  }

  // 4. Handle multiple cart rules (edge case):
  // We select the rule that yields the largest saving.
  // This is a sensible default because customers expect the best discount to apply.
  const ruleSavings = eligibleRules.map((rule) => {
    let saved = 0
    if (rule.type === 'percentage') {
      saved = Math.round((cartSubtotal * rule.value) / 100)
    } else if (rule.type === 'flat') {
      // Cart rules are specified as "always percentage for cart rules" in the spec,
      // but we handle flat here just in case of future extensions.
      saved = rule.value
    }
    return { rule, saved }
  })

  // Sort by savings descending, so the one giving the largest saving is first
  ruleSavings.sort((a, b) => b.saved - a.saved)
  const best = ruleSavings[0]

  const amountSaved = best.saved
  const finalCartTotal = cartSubtotal - amountSaved
  const bestRule = best.rule

  return {
    cartSubtotal,
    cartOfferApplied: true,
    cartOfferLabel: `Cart offer: ${bestRule.value}% off — Rs.${amountSaved.toLocaleString('en-IN')} saved`,
    amountSaved,
    finalCartTotal,
  }
}
