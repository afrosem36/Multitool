// ─── AI Capability Detection & Intent Classification ────────────────────────
// Helps the AI understand what it can/cannot do and respond naturally about limitations

export const CAPABILITY_MAP = {
  image_generation: {
    supported: true,
    cost: 3,
    patterns: [
      /\b(generate|create|draw|make|design|paint|render)\b.*\b(image|picture|photo|artwork|illustration|graphic|visual)\b/i,
      /\b(show me|visualize|illustrate).*(a |an |the )?[a-z]/i,
      /draw.*(me |a |an )?[a-z]/i,
      /what does.*(look like|appear as)\b/i,
    ],
  },
  transcription: {
    supported: true,
    cost: 2,
    patterns: [
      /\b(transcribe|convert|translate).*(audio|speech|voice|recording)\b/i,
      /\b(upload|record|send).*(audio|voice|mp3|wav)\b/i,
    ],
  },
  live_weather: {
    supported: false,
    cost: 1,
    patterns: [/\b(weather|temperature|rain|sunny|forecast|wind|humidity)\b/i],
    contextHint: 'I don\'t currently have access to live weather data or real-time information.',
  },
  live_stocks: {
    supported: false,
    cost: 1,
    patterns: [
      /\b(stock price|market|crypto|bitcoin|ethereum|trading|nasdaq|dow jones|s&p|forex)\b/i,
    ],
    contextHint:
      'I don\'t have real-time stock market or cryptocurrency data access. I can explain concepts but not current prices.',
  },
  live_news: {
    supported: false,
    cost: 1,
    patterns: [
      /\b(latest news|breaking news|headline|current event|today\'s news|breaking|latest)\b/i,
    ],
    contextHint:
      'I don\'t have access to live news feeds or current events. My knowledge has a cutoff date.',
  },
  live_elections: {
    supported: false,
    cost: 1,
    patterns: [/\b(election|vote|polling|political|candidate|campaign|results)\b/i],
    contextHint:
      'I can explain the electoral process, but I don\'t have real-time polling data or current election results.',
  },
  live_sports: {
    supported: false,
    cost: 1,
    patterns: [
      /\b(score|game|match|team|league|championship|final|championship|basketball|football|soccer|cricket|baseball)\b.*\b(today|live|score|result)\b/i,
    ],
    contextHint: 'I can explain sports rules and history, but I don\'t have real-time game scores or live updates.',
  },
  code: {
    supported: true,
    cost: 1,
    patterns: [
      /\b(write|code|program|function|script|debug|fix|refactor|algorithm)\b/i,
      /^\s*(function|const|let|var|class|def|if|for|while|return)/im,
    ],
  },
  math: {
    supported: true,
    cost: 1,
    patterns: [
      /\b(calculate|solve|equation|algebra|calculus|derivative|integral|formula)\b/i,
      /\d+\s*[\+\-\*\/\=\^]/,
    ],
  },
  writing: {
    supported: true,
    cost: 1,
    patterns: [
      /\b(write|draft|compose|essay|story|letter|email|article|poem|song|script)\b/i,
    ],
  },
  translation: {
    supported: true,
    cost: 1,
    patterns: [/\b(translate|language|spanish|french|german|chinese|japanese|arabic)\b/i],
  },
  analysis: {
    supported: true,
    cost: 1,
    patterns: [
      /\b(analyze|analyze|explain|break down|understand|summary|tldr|summarize)\b/i,
    ],
  },
};

export function classifyIntent(text) {
  if (!text) return { type: 'unknown', cost: 1, supported: true, contextHint: null };

  const lower = text.toLowerCase();

  // Check each capability in order of priority
  for (const [capabilityType, capability] of Object.entries(CAPABILITY_MAP)) {
    for (const pattern of capability.patterns) {
      if (pattern.test(lower)) {
        return {
          type: capabilityType,
          cost: capability.cost,
          supported: capability.supported,
          contextHint: capability.contextHint || null,
        };
      }
    }
  }

  // Default: text message
  return { type: 'unknown', cost: 1, supported: true, contextHint: null };
}

export function buildContextForIntent(intent) {
  if (!intent.contextHint) return '';

  // This hint is injected into the system prompt for that turn,
  // so the AI responds naturally about its limitations
  return `\n\n[Context: ${intent.contextHint}]`;
}
