import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
import react from '@vitejs/plugin-react'

const SYSTEM_PROMPT = `You are a precise JSON generator. Your task is to parse a plain-English discount rule description into a single structured JSON object matching the DiscountRule shape.

DISCOUNTRULE SHAPE:
{
  "scope": "brand" | "platform" | "cart",
  "applies_to": string (e.g. brand name or platform name, empty/omitted if scope is "cart"),
  "type": "percentage" | "flat",
  "value": number (positive integer or float),
  "stackable": boolean,
  "min_cart_value": number (only if scope is "cart", must be a positive number)
}

RULES:
1. Return ONLY the raw JSON object. Do NOT include any markdown code fences (like \`\`\`json), do NOT include any introductory or concluding text, and do NOT include any other explanation.
2. If the input is ambiguous, missing a value, or missing a threshold (for cart rules), return an object with an error field:
   { "error": "unresolvable", "message": "Reason why it is unresolvable" }
3. Do NOT guess default values if they are missing and critical (e.g. if no value is specified, or no threshold is specified for a cart rule).

EXAMPLES:
Input: "20% off for Natura Casa brand, stackable with other offers"
Output: {"scope": "brand", "applies_to": "Natura Casa", "type": "percentage", "value": 20, "stackable": true}

Input: "Rs.100 flat discount on all Flipkart items"
Output: {"scope": "platform", "applies_to": "Flipkart", "type": "flat", "value": 100, "stackable": false}

Input: "10% off if cart value is more than Rs.5,000"
Output: {"scope": "cart", "type": "percentage", "value": 10, "stackable": false, "min_cart_value": 5000}

Input: "Give a discount for big orders"
Output: {"error": "unresolvable", "message": "Missing discount value and cart value threshold."}
`;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      {
        name: 'configure-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/parse-rule' && req.method === 'POST') {
              let body = ''
              req.on('data', chunk => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  const { text } = JSON.parse(body)
                  const apiKey = env.GROQ_API_KEY
                  if (!apiKey) {
                    res.statusCode = 500
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'GROQ_API_KEY is not configured on the server. Please add it to your .env file.' }))
                    return
                  }

                  // Call Groq API
                  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                      model: 'llama-3.3-70b-versatile',
                      messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: `Parse this rule: "${text}"` }
                      ],
                      temperature: 0
                    })
                  })

                  const data = await response.json()
                  if (!response.ok) {
                    res.statusCode = response.status
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: data.error?.message || 'Groq API error' }))
                    return
                  }

                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ result: data.choices[0].message.content.trim() }))
                } catch (err) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err.message }))
                }
              })
            } else {
              next()
            }
          })
        }
      }
    ]
  }
})
