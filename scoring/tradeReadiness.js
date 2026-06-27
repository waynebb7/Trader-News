function computeTradeReadiness(context) {
  const {
    newsItems = [],
    priceData = {},
    earnings = null,
    economicEvents = [],
    politicalEvents = [],
    alerts = []
  } = context;

  let bullishScore = 0;
  let bearishScore = 0;
  let eventRiskScore = 0;
  const bullishDrivers = [];
  const bearishDrivers = [];
  const neutralNoise = [];

  const decisionNews = newsItems.filter(n =>
    n.sourceCredibility?.includeInDecision !== false &&
    n.relevanceScore >= 40
  );

  for (const item of decisionNews.slice(0, 20)) {
    const weight = (item.relevanceScore / 100) * (item.sourceCredibility?.credibilityScore / 100);
    const impactMult = { Low: 0.5, Medium: 1, High: 1.5, Critical: 2 }[item.marketImpact] || 1;

    if (item.sentiment?.label === 'bullish') {
      bullishScore += item.sentiment.rawSentimentScore * weight * impactMult * 100;
      if (bullishDrivers.length < 3) bullishDrivers.push(item.headline);
    } else if (item.sentiment?.label === 'bearish') {
      bearishScore += Math.abs(item.sentiment.rawSentimentScore) * weight * impactMult * 100;
      if (bearishDrivers.length < 3) bearishDrivers.push(item.headline);
    } else {
      if (neutralNoise.length < 3) neutralNoise.push(item.headline);
    }
  }

  if (priceData.changePercent > 1.5) {
    bullishScore += 15;
    if (bullishDrivers.length < 3) bullishDrivers.push(`Price up ${priceData.changePercent.toFixed(2)}% today`);
  } else if (priceData.changePercent < -1.5) {
    bearishScore += 15;
    if (bearishDrivers.length < 3) bearishDrivers.push(`Price down ${Math.abs(priceData.changePercent).toFixed(2)}% today`);
  }

  if (priceData.gapStatus === 'gap-up') bullishScore += 8;
  if (priceData.gapStatus === 'gap-down') bearishScore += 8;

  let keyEventRisk = null;

  if (earnings?.daysUntil != null && earnings.daysUntil <= 7) {
    eventRiskScore += 40;
    keyEventRisk = `Earnings in ${earnings.daysUntil} day(s) — ${earnings.date}`;
  }

  const todayMacro = economicEvents.filter(e => e.isToday && ['High', 'Critical'].includes(e.expectedImpact));
  if (todayMacro.length) {
    eventRiskScore += 25;
    keyEventRisk = keyEventRisk || `Macro event today: ${todayMacro[0].eventName}`;
  }

  const todayPolitical = politicalEvents.filter(e => e.isToday);
  if (todayPolitical.length) {
    eventRiskScore += 20;
    keyEventRisk = keyEventRisk || `Political event today: ${todayPolitical[0].eventName}`;
  }

  const net = bullishScore - bearishScore;
  let marketRead = 'Neutral';
  let tradeState = 'GREY';
  let suggestedAction = 'Watch only';
  let confidence = Math.min(85, 35 + decisionNews.length * 3);

  if (eventRiskScore >= 35) {
    marketRead = 'Event risk';
    tradeState = 'AMBER';
    suggestedAction = 'Avoid until after event';
    confidence = Math.min(confidence, 70);
  } else if (net >= 25 && bullishScore > bearishScore * 1.5) {
    marketRead = 'Bullish';
    tradeState = 'GREEN';
    suggestedAction = 'Prepare long idea';
    confidence = Math.min(90, confidence + 10);
  } else if (net <= -25 && bearishScore > bullishScore * 1.5) {
    marketRead = 'Bearish';
    tradeState = 'RED';
    suggestedAction = 'Prepare short idea';
    confidence = Math.min(90, confidence + 10);
  } else if (Math.abs(net) < 15) {
    marketRead = 'Neutral';
    tradeState = 'GREY';
    suggestedAction = 'Watch only';
  } else {
    marketRead = 'Mixed';
    tradeState = 'GREY';
    suggestedAction = 'Watch only';
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'Critical' || a.severity === 'Warning');
  if (criticalAlerts.some(a => a.type === 'breaking-news' || a.type === 'high-impact-news')) {
    tradeState = 'AMBER';
    suggestedAction = 'High-volatility news risk';
    marketRead = 'Event risk';
  }

  const overallSentiment = Math.max(-1, Math.min(1, net / 100));

  return {
    marketRead,
    tradeState,
    confidence: Math.round(confidence),
    overallSentiment: Math.round(overallSentiment * 100) / 100,
    bullishDrivers: bullishDrivers.slice(0, 3),
    bearishDrivers: bearishDrivers.slice(0, 3),
    neutralNoise: neutralNoise.slice(0, 3),
    keyEventRisk,
    suggestedAction,
    disclaimer: 'Decision support only — not financial advice. Verify all information before trading.'
  };
}

function generateAlerts(context) {
  const alerts = [];
  const { newsItems = [], priceData = {}, earnings, economicEvents = [], politicalEvents = [], providerStatus = {}, dataFreshness = {} } = context;

  for (const item of newsItems) {
    if (item.timeSensitivity === 'Breaking' && item.marketImpact === 'Critical') {
      alerts.push({ severity: 'Critical', type: 'breaking-news', message: `Breaking: ${item.headline}`, timestamp: Date.now() });
    } else if (item.marketImpact === 'High' && item.sourceCredibility?.credibilityScore >= 75) {
      alerts.push({ severity: 'Warning', type: 'high-impact-news', message: `High impact: ${item.headline}`, timestamp: Date.now() });
    }
  }

  if (earnings?.daysUntil != null && earnings.daysUntil <= 7) {
    alerts.push({ severity: earnings.daysUntil <= 2 ? 'Critical' : 'Warning', type: 'earnings-soon', message: `Earnings in ${earnings.daysUntil} day(s)`, timestamp: Date.now() });
  }

  if (economicEvents.some(e => e.isToday && e.expectedImpact === 'Critical')) {
    alerts.push({ severity: 'Warning', type: 'macro-today', message: 'Major macro event scheduled today', timestamp: Date.now() });
  }

  if (politicalEvents.some(e => e.isToday)) {
    alerts.push({ severity: 'Watch', type: 'political-today', message: 'White House / presidential activity scheduled today', timestamp: Date.now() });
  }

  if (priceData.gapStatus && priceData.gapStatus !== 'none') {
    alerts.push({ severity: 'Watch', type: 'price-gap', message: `Price ${priceData.gapStatus.replace('-', ' ')} detected`, timestamp: Date.now() });
  }

  for (const [provider, status] of Object.entries(providerStatus)) {
    if (status.status === 'failed' || status.status === 'missing-key') {
      alerts.push({ severity: 'Info', type: 'api-failed', message: `${provider} data unavailable: ${status.message}`, timestamp: Date.now() });
    }
  }

  if (dataFreshness.stale) {
    alerts.push({ severity: 'Warning', type: 'data-stale', message: 'Some data is stale — refresh or check API status', timestamp: Date.now() });
  }

  return alerts.slice(0, 15);
}

module.exports = { computeTradeReadiness, generateAlerts };
