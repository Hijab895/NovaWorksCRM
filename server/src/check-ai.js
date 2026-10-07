import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(serverRoot, '.env')
const apiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta'
const preferredModel = 'gemini-3.5-flash'

dotenv.config({ path: envPath, quiet: true })

function apiModelId(name) {
  return name.startsWith('models/') ? name.slice('models/'.length) : name
}

async function geminiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const error = new Error('Gemini API request failed')
    error.status = response.status
    throw error
  }

  return response.json()
}

async function listGenerateContentModels() {
  const models = []
  let pageToken

  do {
    const params = new URLSearchParams({ pageSize: '1000' })
    if (pageToken) params.set('pageToken', pageToken)

    const data = await geminiRequest(`/models?${params}`)
    models.push(
      ...(data.models ?? []).filter((model) =>
        model.supportedGenerationMethods?.includes('generateContent'),
      ),
    )
    pageToken = data.nextPageToken
  } while (pageToken)

  return models
}

function saveVerifiedModel(modelId) {
  const envContent = readFileSync(envPath, 'utf8')
  const modelLine = `GEMINI_MODEL=${modelId}`
  const updatedContent = /^GEMINI_MODEL=.*$/m.test(envContent)
    ? envContent.replace(/^GEMINI_MODEL=.*$/m, modelLine)
    : `${envContent}${envContent.endsWith('\n') ? '' : '\n'}${modelLine}\n`

  writeFileSync(envPath, updatedContent)
}

function reportError(error) {
  if (error?.name === 'TimeoutError') {
    console.error('Gemini API check failed: request timed out after 30 seconds.')
    return
  }

  if (typeof error?.status === 'number') {
    console.error(`Gemini API check failed: HTTP ${error.status}.`)
    return
  }

  if (error?.message === 'Unexpected model response') {
    console.error('Gemini API check failed: model returned an unexpected response.')
    return
  }

  if (error?.message === 'Missing GEMINI_API_KEY') {
    console.error('Gemini API check failed: GEMINI_API_KEY is not configured.')
    return
  }

  console.error('Gemini API check failed: network or configuration error.')
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  const models = await listGenerateContentModels()
  const modelIds = models.map((model) => apiModelId(model.name)).sort()

  console.log('Available generateContent models:')
  for (const modelId of modelIds) console.log(`- ${modelId}`)

  if (!modelIds.includes(preferredModel)) {
    const error = new Error('Preferred model is unavailable')
    error.status = 404
    throw error
  }

  const result = await geminiRequest(`/models/${preferredModel}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
      generationConfig: { maxOutputTokens: 64, temperature: 0 },
    }),
  })
  const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

  if (responseText !== 'OK') {
    throw new Error('Unexpected model response')
  }

  saveVerifiedModel(preferredModel)
  console.log(`Gemini API check succeeded with model: ${preferredModel}`)
}

main().catch((error) => {
  reportError(error)
  process.exitCode = 1
})
