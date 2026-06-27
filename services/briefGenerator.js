const { saveDailyBrief } = require('../db/database');
const { getDashboardData } = require('./orchestrator');

async function generateDailyBrief(instrument) {
  const dash = await getDashboardData(instrument);
  const d = dash.decision;
  const today = new Date().toISOString().slice(0, 10);

  const summary = `${instrument.displayName} (${instrument.symbol}) — ${d.marketRead} read with ${d.confidence}% confidence. ` +
    `Price ${dash.quote.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(dash.quote.changePercent || 0).toFixed(2)}%. ` +
    `${dash.news.length} news items analysed. ${d.keyEventRisk ? `Key risk: ${d.keyEventRisk}.` : 'No major event risk flagged.'} ` +
    `Suggested action: ${d.suggestedAction}. This is decision support only, not financial advice.`;

  const brief = {
    briefDate: today,
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    summary,
    bullishDrivers: d.bullishDrivers,
    bearishDrivers: d.bearishDrivers,
    keyRisk: d.keyEventRisk || 'None flagged',
    nextEvent: dash.earnings?.date || dash.economicEvents?.[0]?.eventName || 'None scheduled',
    recommendation: d.suggestedAction
  };

  saveDailyBrief(brief);
  return brief;
}

async function generateAllBriefs(instruments) {
  const favourites = instruments.filter(i => i.favourite);
  const targets = favourites.length ? favourites : instruments.slice(0, 3);
  const briefs = [];
  for (const inst of targets) {
    briefs.push(await generateDailyBrief(inst));
  }
  return briefs;
}

module.exports = { generateDailyBrief, generateAllBriefs };
