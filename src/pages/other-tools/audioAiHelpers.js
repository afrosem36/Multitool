// ─── AI Enhancement Helpers — Backend chain: Gemini → OpenAI → Groq ──
// All text analysis / QA / refinement uses the centralized /api/ai/generate endpoint
// which runs the full Gemini → OpenAI → Groq llama-3.3-70b fallback server-side.

function extractContent(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .filter((c) => c?.type === 'text' || typeof c?.text === 'string')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
  }
  return '';
}

function extractTextFromResponse(response) {
  if (typeof response === 'string') return response.trim();

  // OpenAI / Groq choices array
  if (Array.isArray(response?.choices)) {
    const content = response.choices[0]?.message?.content;
    if (content != null) return extractContent(content);
  }

  // Direct message wrapper
  if (response?.message?.content != null) return extractContent(response.message.content);

  // Flat content field
  if (response?.content != null) return extractContent(response.content);

  // Plain text field
  if (response?.text != null) return extractContent(response.text);

  // Last resort — only if it doesn't produce [object Object]
  const str = String(response ?? '');
  return str && str !== '[object Object]' && str !== 'undefined' ? str.trim() : '';
}

// Read which providers the admin has disabled via the AI Monitor toggle
function getDisabledProviders() {
  try { return JSON.parse(localStorage.getItem('ai_disabled_providers') || '[]'); } catch { return []; }
}

// Flow: backend runs Gemini 3.1 Flash Lite → OpenAI gpt-4.1-mini → Groq llama-3.3-70b
// Skips any provider the admin has toggled off in the AI Monitor panel.
export async function callAI(messages, { apiFetch, onProvider }) {
  const disabled = getDisabledProviders();

  try {
    const res = await apiFetch('/api/ai/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages, disabledProviders: disabled }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.text?.trim()) {
        onProvider?.(data.source || 'gemini');
        return data.text.trim();
      }
    }
  } catch (backendErr) {
    console.warn('[AI] Backend failed:', backendErr.message);
  }

  throw new Error('All AI providers failed or disabled — please try again later');
}

// Build prompts for various AI enhancement tasks

export function buildImproveTextPrompt(transcript) {
  return [
    {
      role: 'system',
      content: `You are a call transcript quality improvement assistant. Your job is to improve the transcript while preserving:
- Speaker labels ([Speaker N]:) exactly as they are
- Original meaning and intent
- Hinglish/Hindi phrases naturally (do NOT translate to pure English or over-formalize)
- Timestamps if present
- Conversational tone (do NOT make it overly formal or robotic)
- All speaker names and identities

Make these improvements:
- Fix grammar and punctuation
- Improve readability and flow
- Ensure proper capitalization
- Fix common speech-to-text errors
- Add proper sentence breaks

Return ONLY the improved transcript, nothing else.`,
    },
    {
      role: 'user',
      content: `Improve this transcript:\n\n${transcript}`,
    },
  ];
}

export function buildTranslationPolishPrompt(transcript, sourceLanguage, targetLanguage) {
  return [
    {
      role: 'system',
      content: `You are a translation quality improvement specialist. Your job is to polish translated text for:
- Natural wording in ${targetLanguage}
- Better sentence flow and readability
- Conversational formatting
- Preserve business/call-center tone
- Keep speaker labels ([Speaker N]:) intact
- Preserve timestamps if present
- Keep names and proper nouns unchanged

Make the translation sound natural and professional, not robotic.
Return ONLY the polished transcript, nothing else.`,
    },
    {
      role: 'user',
      content: `Polish this ${targetLanguage} translation (originally from ${sourceLanguage}):\n\n${transcript}`,
    },
  ];
}

export function buildQaAnalysisPrompt(transcript, qaParams, totalMarks) {
  const paramsList = qaParams.map((p) => `- ${p.name}: ${p.marks} marks`).join('\n');

  return [
    {
      role: 'system',
      content: `You are an expert call quality analyst. Analyze the provided call transcript against the QA parameters and provide a detailed structured report.

For each parameter, provide:
1. A score (out of the max marks for that parameter)
2. Specific feedback about performance

Also provide:
- List of 3-4 key strengths demonstrated in the call
- List of 3-4 key areas for improvement
- Overall performance rating: "Excellent" (85%+), "Good" (70-84%), "Average" (50-69%), "Below Average" (<50%)
- A brief overall summary (2-3 sentences)

Return response as valid JSON only, in this exact format:
{
  "parameters": [
    {
      "name": "Parameter Name",
      "score": 8,
      "maxScore": 10,
      "feedback": "Specific feedback about this parameter"
    }
  ],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasToImprove": ["Area 1", "Area 2", "Area 3"],
  "finalScore": 39,
  "totalMarks": 50,
  "performance": "Good",
  "summary": "Brief overall summary of call performance."
}`,
    },
    {
      role: 'user',
      content: `Analyze this call transcript against these QA parameters:

QA Parameters:
${paramsList}
Total Marks: ${totalMarks}

CALL TRANSCRIPT:
${transcript}

Provide the JSON analysis now.`,
    },
  ];
}

export function buildSummarizePrompt(transcript) {
  return [
    {
      role: 'system',
      content: `You are a call transcription summarizer. Summarize the provided call transcript in 3-5 sentences.

Capture:
- Main purpose of the call
- Key topics discussed
- Outcome/resolution
- Any action items mentioned

Keep it concise, professional, and factual.`,
    },
    {
      role: 'user',
      content: `Summarize this call transcript:\n\n${transcript}`,
    },
  ];
}

export function buildExtractKeyPointsPrompt(transcript) {
  return [
    {
      role: 'system',
      content: `You are a call transcription analyst. Extract 5-8 key points from the provided call transcript.

Format as bullet points. Each point should be:
- Clear and concise
- Actionable or informative
- In the context of a call/conversation

Return only the bullet points, one per line, starting with "- ".`,
    },
    {
      role: 'user',
      content: `Extract key points from this call transcript:\n\n${transcript}`,
    },
  ];
}

// Helper to parse QA JSON response safely
export function parseQaReport(jsonText) {
  try {
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (
      !Array.isArray(parsed.parameters)
      || !Array.isArray(parsed.strengths)
      || !Array.isArray(parsed.areasToImprove)
      || typeof parsed.finalScore !== 'number'
      || typeof parsed.totalMarks !== 'number'
    ) {
      throw new Error('Invalid QA report structure');
    }

    return parsed;
  } catch (err) {
    console.error('[QA Parse] Failed to parse QA report:', err);
    throw new Error(`Failed to parse QA report: ${err.message}`);
  }
}

// Helper to parse key points (bulleted list)
export function parseKeyPoints(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 8); // Limit to 8 points
}
