import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to handle /api/parse-rule locally during dev
function localApiProxy() {
  return {
    name: 'local-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/parse-rule', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { text } = JSON.parse(body);
            const apiKey = process.env.GROQ_API_KEY;

            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'GROQ_API_KEY not found in .env' }));
              return;
            }

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
1. Return ONLY the raw JSON object. Do NOT include any markdown code fences, do NOT include any introductory or concluding text.
2. If the input is ambiguous or missing values, return: { "error": "unresolvable", "message": "Reason" }.
3. Do NOT guess default values if they are missing and critical.

EXAMPLES:
Input: "20% off for Natura Casa brand, stackable with other offers"
Output: {"scope": "brand", "applies_to": "Natura Casa", "type": "percentage", "value": 20, "stackable": true}

Input: "Rs.100 flat discount on all Flipkart items"
Output: {"scope": "platform", "applies_to": "Flipkart", "type": "flat", "value": 100, "stackable": false}

Input: "10% off if cart value is more than Rs.5,000"
Output: {"scope": "cart", "type": "percentage", "value": 10, "stackable": false, "min_cart_value": 5000}`;

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: `Parse this rule: "${text}"` },
                ],
                temperature: 0,
              }),
            });

            const data = await groqRes.json();
            res.setHeader('Content-Type', 'application/json');

            if (!groqRes.ok) {
              res.statusCode = groqRes.status;
              res.end(JSON.stringify({ error: data.error?.message || 'Groq API error' }));
              return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ result: data.choices[0].message.content.trim() }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.GROQ_API_KEY = env.GROQ_API_KEY;

  return {
    plugins: [react(), localApiProxy()],
  };
});
