const { getSourceCredibility } = require('../server/configLoader');

const FINANCIAL_POSITIVE = [
  'beat', 'beats', 'exceed', 'upgrade', 'upgraded', 'buy rating', 'outperform',
  'record revenue', 'record earnings', 'backlog', 'contract win', 'guidance raise',
  'raised guidance', 'strong demand', 'dividend increase', 'buyback', 'surge', 'rally'
];

const FINANCIAL_NEGATIVE = [
  'miss', 'misses', 'downgrade', 'downgraded', 'sell rating', 'underperform',
  'cut guidance', 'lowered guidance', 'weak demand', 'layoffs', 'investigation',
  'lawsuit', 'recall', 'delay', 'slump', 'plunge', 'bankruptcy', 'warning'
];

const DEFENCE_BULLISH = [
  'defence contract', 'defense contract', 'missile contract', 'pentagon', 'nato',
  'military budget', 'defence spending', 'defense spending', 'weapons', 'backlog increase',
  'f-35', 'hypersonic', 'aerospace award'
];

const DEFENCE_BEARISH = [
  'defence cut', 'defense cut', 'program cancellation', 'contract loss', 'export ban',
  'sanctions', 'investigation', 'cost overrun'
];

const MACRO_BEARISH = [
  'recession', 'inflation surge', 'rate hike', 'hawkish', 'shutdown', 'debt ceiling',
  'war escalation', 'geopolitical tension', 'tariff', 'trade war'
];

const MACRO_BULLISH = [
  'rate cut', 'dovish', 'soft landing', 'stimulus', 'peace deal', 'ceasefire'
];

const TAG_PATTERNS = [
  { tag: 'earnings', patterns: ['earnings', 'eps', 'quarterly results', 'q1', 'q2', 'q3', 'q4'] },
  { tag: 'contract', patterns: ['contract', 'award', 'order', 'backlog'] },
  { tag: 'guidance', patterns: ['guidance', 'outlook', 'forecast'] },
  { tag: 'macro', patterns: ['fed', 'fomc', 'cpi', 'inflation', 'gdp', 'jobs report', 'nfp'] },
  { tag: 'defence', patterns: ['defence', 'defense', 'pentagon', 'nato', 'military', 'missile'] },
  { tag: 'government', patterns: ['congress', 'senate', 'white house', 'executive order', 'budget'] },
  { tag: 'geopolitics', patterns: ['ukraine', 'russia', 'china', 'taiwan', 'middle east', 'sanctions'] },
  { tag: 'litigation', patterns: ['lawsuit', 'litigation', 'sec probe', 'investigation'] },
  { tag: 'analyst rating', patterns: ['upgrade', 'downgrade', 'price target', 'analyst'] },
  { tag: 'insider', patterns: ['insider', 'form 4', 'executive sale', 'executive purchase'] },
  { tag: 'product', patterns: ['launch', 'product', 'unveil', 'prototype'] },
  { tag: 'supply chain', patterns: ['supply chain', 'shortage', 'delivery delay'] },
  { tag: 'political', patterns: ['trump', 'president', 'tariff', 'trade policy'] },
  { tag: 'central bank', patterns: ['fed', 'ecb', 'boe', 'rate decision'] },
  { tag: 'inflation', patterns: ['cpi', 'ppi', 'inflation'] },
  { tag: 'employment', patterns: ['nonfarm', 'unemployment', 'jobs', 'payrolls'] },
  { tag: 'crypto', patterns: ['bitcoin', 'crypto', 'blockchain', 'etf approval'] },
  { tag: 'commodity', patterns: ['oil', 'gold', 'copper', 'inventory', 'opec'] },
  { tag: 'forex', patterns: ['dollar', 'euro', 'yen', 'currency', 'fx'] }
];

function countMatches(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
}

function extractTags(text) {
  const lower = text.toLowerCase();
  const tags = [];
  for (const { tag, patterns } of TAG_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) tags.push(tag);
  }
  return tags.length ? tags : ['macro'];
}

function detectCatalystType(tags) {
  if (tags.includes('earnings')) return 'earnings';
  if (tags.includes('contract') || tags.includes('defence')) return 'company';
  if (tags.includes('geopolitics') || tags.includes('political')) return 'geopolitical';
  if (tags.includes('macro') || tags.includes('central bank')) return 'macro';
  if (tags.includes('analyst rating')) return 'analyst';
  if (tags.includes('litigation')) return 'regulatory';
  if (tags.includes('insider')) return 'official filing';
  return 'company';
}

function detectImpactHorizon(tags, text) {
  const lower = text.toLowerCase();
  if (lower.includes('breaking') || lower.includes('just in') || lower.includes('live')) return 'immediate';
  if (tags.includes('earnings') || tags.includes('macro')) return 'today';
  if (tags.includes('guidance') || tags.includes('contract')) return 'this week';
  if (tags.includes('geopolitics')) return 'this month';
  return 'today';
}

function sectorAdjustScore(baseScore, sector, text) {
  const sectorRules = require('../server/configLoader').getSectorRules();
  const rules = sectorRules[sector] || sectorRules['broad-market'];
  const lower = text.toLowerCase();
  let adj = 0;
  for (const kw of rules.bullishKeywords || []) {
    if (lower.includes(kw)) adj += 0.15;
  }
  for (const kw of rules.bearishKeywords || []) {
    if (lower.includes(kw)) adj -= 0.15;
  }
  return Math.max(-1, Math.min(1, baseScore + adj));
}

function analyzeSentiment(headline, summary, instrument) {
  const text = `${headline} ${summary || ''}`.trim();
  const sector = instrument?.sector || 'broad-market';

  let score = 0;
  score += countMatches(text, FINANCIAL_POSITIVE) * 0.2;
  score -= countMatches(text, FINANCIAL_NEGATIVE) * 0.2;

  if (sector === 'defence' || sector === 'aerospace') {
    score += countMatches(text, DEFENCE_BULLISH) * 0.25;
    score -= countMatches(text, DEFENCE_BEARISH) * 0.25;
  }

  score -= countMatches(text, MACRO_BEARISH) * 0.1;
  score += countMatches(text, MACRO_BULLISH) * 0.1;

  score = sectorAdjustScore(Math.max(-1, Math.min(1, score)), sector, text);

  const tags = extractTags(text);
  let label = 'neutral';
  if (score >= 0.25) label = 'bullish';
  else if (score <= -0.25) label = 'bearish';
  else if (Math.abs(score) < 0.15 && (countMatches(text, FINANCIAL_POSITIVE) && countMatches(text, FINANCIAL_NEGATIVE))) {
    label = 'mixed';
  }

  const matchCount = countMatches(text, [...FINANCIAL_POSITIVE, ...FINANCIAL_NEGATIVE, ...DEFENCE_BULLISH, ...DEFENCE_BEARISH]);
  const confidence = Math.min(95, 40 + matchCount * 12);

  const reasons = [];
  if (countMatches(text, DEFENCE_BULLISH)) reasons.push('Defence/aerospace positive catalyst language detected');
  if (countMatches(text, DEFENCE_BEARISH)) reasons.push('Defence sector risk language detected');
  if (countMatches(text, FINANCIAL_POSITIVE)) reasons.push('Positive financial keywords');
  if (countMatches(text, FINANCIAL_NEGATIVE)) reasons.push('Negative financial keywords');
  if (!reasons.length) reasons.push('Limited directional keywords; classified as neutral');

  return {
    rawSentimentScore: Math.round(score * 100) / 100,
    label,
    confidence,
    reason: reasons.join('. '),
    catalystType: detectCatalystType(tags),
    impactHorizon: detectImpactHorizon(tags, text),
    tags
  };
}

function estimateMarketImpact(sentiment, tags, credibilityScore) {
  const highImpactTags = ['earnings', 'guidance', 'contract', 'macro', 'geopolitics', 'litigation'];
  const tagWeight = tags.filter(t => highImpactTags.includes(t)).length;
  let impact = 'Low';
  const absScore = Math.abs(sentiment.rawSentimentScore);
  if (tagWeight >= 2 && absScore >= 0.4 && credibilityScore >= 70) impact = 'Critical';
  else if (tagWeight >= 1 && absScore >= 0.3 && credibilityScore >= 60) impact = 'High';
  else if (absScore >= 0.2 || tagWeight >= 1) impact = 'Medium';
  return impact;
}

function estimateTimeSensitivity(publishedAt) {
  if (!publishedAt) return 'Old';
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const hours = ageMs / 3600000;
  if (hours < 1) return 'Breaking';
  if (hours < 6) return 'Fresh';
  if (hours < 48) return 'Developing';
  return 'Old';
}

function scoreRelevance(text, instrument) {
  const lower = text.toLowerCase();
  let score = 30;
  if (lower.includes(instrument.symbol.toLowerCase())) score += 40;
  if (lower.includes(instrument.displayName.toLowerCase())) score += 30;
  for (const tag of instrument.tags || []) {
    if (lower.includes(tag.replace('-', ' '))) score += 10;
  }
  if (instrument.sector && lower.includes(instrument.sector)) score += 15;
  return Math.min(100, score);
}

function enrichNewsItem(item, instrument) {
  const sentiment = item.providerSentiment || analyzeSentiment(item.headline, item.summary, instrument);
  const credibility = require('../scoring/credibility').getCredibilityForSource(item.source, item.url);
  const relevance = scoreRelevance(`${item.headline} ${item.summary}`, instrument);

  return {
    ...item,
    sentiment: {
      label: sentiment.label,
      confidence: sentiment.confidence,
      rawSentimentScore: sentiment.rawSentimentScore,
      reason: sentiment.reason,
      catalystType: sentiment.catalystType,
      impactHorizon: sentiment.impactHorizon
    },
    tags: sentiment.tags || item.tags || [],
    relevanceScore: relevance,
    sourceCredibility: credibility,
    marketImpact: estimateMarketImpact(sentiment, sentiment.tags || [], credibility.credibilityScore),
    timeSensitivity: estimateTimeSensitivity(item.publishedAt)
  };
}

module.exports = {
  analyzeSentiment,
  enrichNewsItem,
  extractTags,
  scoreRelevance,
  estimateMarketImpact,
  estimateTimeSensitivity
};
