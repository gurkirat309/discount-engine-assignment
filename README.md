# Opptra Discount Engine — Optimizing cart‑level discounts with flexible inputs

## Live Demo
- **Deployed URL:** [LIVE_URL_HERE]
- **Loom walkthrough:** [LOOM_URL_HERE]

## Run Locally (3 steps)
1. ```bash
   git clone <repo-url> && cd <repo-name> && npm install
   ```
2. Create a `.env.local` file with the following line (required only for the Natural‑Language rule input feature):
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

## Design Decisions & Trade‑offs
- **Groq for NL parsing** – Chosen for its strong instruction‑following capabilities and low latency. The API key is never shipped to the browser; a tiny Vercel serverless function (`api/parse-rule.js`) proxies requests, protecting credentials.
- **Client‑side PDF parsing** – Implemented with `pdfjs-dist` to keep the assignment self‑contained and avoid a backend service. Text‑position‑based table extraction works reliably for the given format but is fragile for arbitrary PDFs; the parser deliberately skips rows that cannot be parsed and surfaces warnings instead of silently discarding data.
- **Malformed rows handling** – Rows that lack a parsable numeric price are omitted, and a warning is shown to the user. This prevents crashes and makes the failure mode explicit.
- **NL rule validation** – After the LLM returns a candidate rule, the front‑end validates required fields (`rule_id`, `scope`, `type`, `value`, `stackable`). If any field is missing or ambiguous, the rule is rejected and the user must edit/confirm before it is added.
- **No persistence** – All state lives in memory as per the assignment brief. A page reload resets cart and rules, which simplifies the demo and eliminates the need for a backend database.
- **No deviations from the spec** – The implementation follows the specification exactly; any design choices (e.g., proxying the Groq key) are strictly for security and do not alter functional requirements.

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
