import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] Missing required env var: ${key}`)
    process.exit(1)
  }
}

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

// ── Edge Function URL ─────────────────────────────────────────────────────────
const EDGE_URL = `${process.env.SUPABASE_URL}/functions/v1/analyse-mention`

// ── Helpers ───────────────────────────────────────────────────────────────────
function nextRunDate(frequency) {
  const ms = frequency === 'daily' ? 86_400_000 : 7 * 86_400_000
  return new Date(Date.now() + ms).toISOString()
}

// ── Core processor ────────────────────────────────────────────────────────────
async function processKeyword(keyword, company) {
  console.log(`[worker] Processing "${keyword.phrase}" for ${company.name}`)

  // Lock the row so other poll cycles skip it
  await supabase
    .from('keywords')
    .update({ status: 'processing' })
    .eq('id', keyword.id)

  try {
    // ── 1. Query Gemini ───────────────────────────────────────────────────────
    const prompt =
      `You are a helpful AI assistant. A user just asked: "${keyword.phrase}". ` +
      `Give a realistic, detailed recommendation as you normally would. ` +
      `Mention specific brands, tools, or services by name.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    console.log(`[worker] Gemini responded (${responseText.length} chars)`)

    // ── 2. Call Supabase Edge Function for ML analysis + insert ──────────────
    const edgeRes = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        keyword_id:    keyword.id,
        response_text: responseText,
        brand_name:    company.name,
        competitors:   company.competitors ?? [],
        engine:        'gemini'
      })
    })

    const edgeResult = await edgeRes.json()

    if (!edgeRes.ok) {
      throw new Error(edgeResult.error ?? `Edge function returned ${edgeRes.status}`)
    }

    console.log(`[worker] Analysis: ${edgeResult.summary}`)

    // ── 3. Update keyword status ──────────────────────────────────────────────
    const updates = {
      status:      'done',
      last_run_at: new Date().toISOString()
    }

    // Manual keywords don't get rescheduled
    if (keyword.frequency !== 'manual') {
      updates.next_run_at = nextRunDate(keyword.frequency)
    }

    await supabase
      .from('keywords')
      .update(updates)
      .eq('id', keyword.id)

    console.log(`[worker] Done — keyword ${keyword.id} complete`)

  } catch (err) {
    console.error(`[worker] Error on keyword ${keyword.id}:`, err.message)

    // Reset to pending so it retries on next poll
    await supabase
      .from('keywords')
      .update({ status: 'pending' })
      .eq('id', keyword.id)
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
async function poll() {
  console.log(`[worker] Poll at ${new Date().toISOString()}`)

  const { data: keywords, error } = await supabase
    .from('keywords')
    .select(`
      id,
      phrase,
      frequency,
      next_run_at,
      companies (
        id,
        name,
        domain,
        competitors
      )
    `)
    .eq('status', 'pending')
    .lte('next_run_at', new Date().toISOString())
    .limit(5)

  if (error) {
    console.error('[worker] Poll query error:', error.message)
    return
  }

  if (!keywords?.length) {
    console.log('[worker] Nothing to process.')
    return
  }

  console.log(`[worker] Found ${keywords.length} keyword(s) to process`)

  for (const keyword of keywords) {
    const company = keyword.companies

    if (!company) {
      console.warn(`[worker] No company for keyword ${keyword.id} — skipping`)
      await supabase
        .from('keywords')
        .update({ status: 'done' })
        .eq('id', keyword.id)
      continue
    }

    await processKeyword(keyword, company)

    // Respect Gemini rate limits — 2s between requests
    await new Promise(r => setTimeout(r, 2000))
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let shuttingDown = false

process.on('SIGTERM', () => {
  console.log('[worker] SIGTERM received — finishing current job then shutting down...')
  shuttingDown = true
})

process.on('uncaughtException', (err) => {
  console.error('[worker] Uncaught exception:', err.message)
  // Don't crash — keep polling
})

process.on('unhandledRejection', (reason) => {
  console.error('[worker] Unhandled rejection:', reason)
  // Don't crash — keep polling
})

// ── Start ─────────────────────────────────────────────────────────────────────
console.log('[worker] GEO Tracker worker starting...')
console.log(`[worker] Supabase: ${process.env.SUPABASE_URL}`)
console.log(`[worker] Edge function: ${EDGE_URL}`)

poll()

const interval = setInterval(() => {
  if (shuttingDown) {
    clearInterval(interval)
    console.log('[worker] Shutdown complete.')
    process.exit(0)
  }
  poll()
}, 5 * 60 * 1000)
