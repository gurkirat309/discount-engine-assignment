# Opptra Discount Engine — Optimizing cart‑level discounts with flexible inputs

## Live Demo
- **Deployed URL:** https://discount-engine-assignment-seven.vercel.app/


## Run Locally (3 steps)
1. ```bash
   git clone <repo-url> && cd <repo-name> && npm install
   ```
2. Create a `.env` file with the following line (required only for the Natural‑Language rule input feature):
   ```
   GROQ_API_KEY=your_key_here
   ```
   _You can obtain a free key from https://console.groq.com/._
3. ```bash
   npm run dev
   ```
   Open http://localhost:5173, upload `sample-data/rules.csv` and `sample-data/cart.csv`, then click **Calculate Discounts**.

## What This Does
The engine first resolves item‑level discounts:
- For each item it picks the **maximum‑value non‑stackable rule** (largest rupee saving).
- All `stackable:true` rules that also match the item are applied on top of that winning rule.
After all items have their final prices, a **cart‑level rule** (if any) is evaluated. When the cart subtotal meets the rule's `min_cart_value`, the configured percentage discount is applied to the subtotal.
All three input paths (CSV, natural‑language text, PDF) ultimately produce the same `DiscountRule[]` and `CartItem[]` shapes, so the core calculator remains untouched.

## Features Implemented
- [x] **Foundation** – Core discount engine with item‑level rule resolution and max‑discount logic.
- [x] **Task 1 – Cart‑level offers** – Threshold‑based percentage discount applied after item‑level discounts, displayed as a separate line.
- [x] **Task 2 – Natural‑language rule input** – Text entry parsed by a Groq LLM, validated, and added only after user confirmation.
- [x] **Task 3 – PDF cart upload** – Client‑side `pdfjs-dist` extraction, robust row‑parsing (via `pdfLineParser.js`), warning on malformed rows, and preview before replacing the cart.

## Design Decisions & Deviations from Spec

The assignment explicitly invites disagreement with design choices if backed by reasoning. Here's where we made deliberate calls different from a literal reading of the spec:

### 1. Editable confirmation step (implemented)
The spec describes a confirmation step that shows parsed fields before adding a natural-language rule. We implemented this as an **editable form** rather than a static read-only card. If the LLM slightly mis-parses a field (e.g. "Amazon" instead of "Amazon India", or an incorrect stackable flag), the user can correct it inline instead of discarding the whole rule and retyping from scratch. The original LLM-parsed values are still shown for transparency, and the same validation logic runs again on submit — so this adds flexibility without weakening the safety net the confirmation step was meant to provide.

### 2. PDF format assumption is fragile (documented, not over-engineered)
The PDF cart upload assumes a very specific table layout (Product, Brand, Platform, Base Price in that column order). Real-world PDF text extraction is inherently unreliable — column order, spacing, and font rendering vary across PDF generators, and a slightly different invoice format could silently produce garbage rows even with our malformed-row detection. We chose not to over-engineer a general-purpose PDF table parser for this scope, but flag this as a real limitation. A more robust alternative for production would be to accept a structured JSON cart upload as a second format alongside PDF — deterministic, schema-validatable, and not dependent on text-position heuristics — or to provide a downloadable "cart template" PDF so uploads are guaranteed to match the expected structure.

### 3. Cart-level rule conflict resolution (documented)
The spec doesn't explicitly define what happens if multiple cart-level rules are active simultaneously and both meet their threshold. For consistency with how item-level rule conflicts are resolved ("apply the one giving the largest discount amount in rupees, scope doesn't matter"), we apply the same logic at the cart level: if multiple cart rules qualify, the one giving the largest rupee saving is applied. This wasn't explicitly stated in the spec but follows the same principle used elsewhere in the engine.

## Architecture / Code Structure
```
src/
 ├─ engine/                # Pure discount logic (unchanged by tasks)
 │   ├─ discountEngine.js   # Calculates final prices
 │   ├─ csvParser.js        # CSV → typed objects
 │   ├─ pdfCartParser.js    # PDF → lines → CartItem[] (client side)
 │   └─ pdfLineParser.js    # Pure‑JS line‑parsing, reusable in tests
 │
 ├─ inputs/                # UI components for each input modality
 │   ├─ CsvUploader.jsx
 │   ├─ NlRuleInput.jsx
 │   └─ PdfUploader.jsx
 │
 ├─ api/                   # Server‑less proxy
 │   └─ parse-rule.js        # Calls Groq LLM; keeps GROQ_API_KEY server‑side
 │
 ├─ components/            # Shared UI pieces (tables, error banners, etc.)
 ├─ App.jsx                 # State orchestration & view composition
 └─ index.css               # Design system (dark mode, gradients, micro‑animations)
```
All three input paths produce identical data structures (`CartItem[]` and `DiscountRule[]`) that feed into the unchanged engine – no core calculator modifications were needed.

## Implementation Trade‑offs
- **Groq for NL parsing** – Chosen for its strong instruction‑following capabilities and low latency. The API key is never shipped to the browser; a tiny Vercel serverless function (`api/parse-rule.js`) proxies requests, protecting credentials.
- **Client‑side PDF parsing** – Implemented with `pdfjs-dist` to keep the assignment self‑contained and avoid a backend service. Text‑position‑based table extraction works reliably for the given format but is fragile for arbitrary PDFs; the parser deliberately skips rows that cannot be parsed and surfaces warnings instead of silently discarding data.
- **Malformed rows handling** – Rows that lack a parsable numeric price are omitted, and a warning is shown to the user. This prevents crashes and makes the failure mode explicit.
- **NL rule validation** – After the LLM returns a candidate rule, the front‑end validates required fields (`scope`, `type`, `value`, `stackable`). If any field is missing or ambiguous, the rule is rejected and the user must edit/confirm via the editable form before it is added.
- **No persistence** – All state lives in memory as per the assignment brief. A page reload resets cart and rules, which simplifies the demo and eliminates the need for a backend database.

## Testing / Verification
- **Foundation** – Verified that the item‑level discount calculations match the expected result table for the supplied sample CSVs.
- **Task 1** – Tested cart totals both above and below the `min_cart_value` threshold; the percentage discount appears only when the threshold is met.
- **Task 2** – Ran all four example natural‑language inputs from the brief, including an ambiguous case; the validation layer rejected incomplete rules and forced user confirmation.
- **Task 3** – Executed the PDF parser against three PDFs:
  1. `cart_well_formed.pdf` – 6 items parsed correctly, 0 warnings.
  2. `cart_malformed.pdf` – 5 valid items, 1 warning for the malformed row.
  3. `cart_unrelated.pdf` – 0 items, warnings for each non‑table line.
  All tests pass (`npm test`), and the UI shows the appropriate preview and warning messages.

## Known Limitations
- PDF parsing assumes the exact column order **Product → Brand → Platform → Base Price**; any deviation breaks extraction.
- No data persistence – refreshing the page clears uploaded carts and added rules.
- The Groq proxy is a minimal wrapper; rate‑limiting or authentication errors surface as generic UI messages.
- The UI currently supports only the sample CSV/PDF formats; extending to other schemas would require additional parsing logic.

---
*This repository is a take‑home assignment for the Opptra FDE Intern role. The codebase demonstrates clean separation of concerns, secure handling of secrets, and graceful error handling while meeting all functional requirements.*
