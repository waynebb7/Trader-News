const express = require('express');
const {
  getAllInstruments,
  findInstrument,
  getInstrumentsConfig,
  saveInstrumentsConfig,
  getSourceCredibility,
  getApiProviders
} = require('../server/configLoader');
const { getDashboardData, getWatchlistData, getProviderStatus, runProviderDiagnostics } = require('../services/orchestrator');
const { generateDailyBrief, generateAllBriefs } = require('../services/briefGenerator');
const {
  getDecisionLogs,
  addDecisionLog,
  updateDecisionLog,
  getDailyBriefs,
  clearCache,
  getSetting,
  setSetting,
  getRecentInstruments,
  saveCustomInstrument,
  deleteCustomInstrument,
  addManualPoliticalEvent,
  getManualPoliticalEvents,
  DB_PATH
} = require('../db/database');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.get('/instruments', (req, res) => {
  const { q, assetType, favourites } = req.query;
  let list = getAllInstruments();
  if (q) {
    const lower = q.toLowerCase();
    list = list.filter(i =>
      i.symbol.toLowerCase().includes(lower) ||
      i.displayName.toLowerCase().includes(lower)
    );
  }
  if (assetType) list = list.filter(i => i.assetType === assetType);
  if (favourites === 'true') list = list.filter(i => i.favourite);
  const recent = getRecentInstruments().map(r => r.symbol);
  res.json({ instruments: list, recent, defaultInstrument: getInstrumentsConfig().defaultInstrument });
});

router.post('/instruments', (req, res) => {
  const body = req.body;
  if (!body.symbol || !body.displayName || !body.assetType) {
    return res.status(400).json({ error: 'symbol, displayName, and assetType required' });
  }
  const instrument = {
    id: body.id || body.symbol.toLowerCase().replace(/[^a-z0-9]/g, ''),
    symbol: body.symbol.toUpperCase(),
    displayName: body.displayName,
    assetType: body.assetType,
    sector: body.sector || 'general',
    tags: body.tags || [],
    favourite: Boolean(body.favourite),
    irUrl: body.irUrl || null,
    secCik: body.secCik || null,
    notes: body.notes || ''
  };
  saveCustomInstrument(instrument);
  res.json({ instrument });
});

router.delete('/instruments/:id', (req, res) => {
  deleteCustomInstrument(req.params.id);
  res.json({ ok: true });
});

router.patch('/instruments/:id/favourite', (req, res) => {
  const config = getInstrumentsConfig();
  const inst = config.instruments.find(i => i.id === req.params.id);
  if (inst) {
    inst.favourite = Boolean(req.body.favourite);
    saveInstrumentsConfig(config);
    return res.json({ instrument: inst });
  }
  const custom = getAllInstruments().find(i => i.id === req.params.id);
  if (custom) {
    custom.favourite = Boolean(req.body.favourite);
    saveCustomInstrument(custom);
    return res.json({ instrument: custom });
  }
  res.status(404).json({ error: 'Instrument not found' });
});

router.get('/dashboard/:symbol', async (req, res) => {
  try {
    const instrument = findInstrument(req.params.symbol);
    if (!instrument) return res.status(404).json({ error: 'Instrument not found' });
    const data = await getDashboardData(instrument, req.query.refresh === 'true');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/watchlist', async (req, res) => {
  try {
    const instruments = getAllInstruments();
    const data = await getWatchlistData(instruments);
    res.json({ watchlist: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/providers/status', (req, res) => {
  res.json(getProviderStatus());
});

router.post('/providers/test', async (req, res) => {
  try {
    const provider = req.body?.provider;
    const equity = findInstrument(req.body?.symbol || 'LMT') || findInstrument('LMT');
    const filing = (getAllInstruments().find(i => i.secCik) || equity);
    const ir = (getAllInstruments().find(i => i.irUrl) || equity);

    const results = await runProviderDiagnostics(provider, { equity, filing, ir });
    res.json({ results, testedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/briefs', (req, res) => {
  const briefs = getDailyBriefs(req.query.date);
  res.json({
    briefs: briefs.map(b => ({
      ...b,
      bullishDrivers: JSON.parse(b.bullish_drivers || '[]'),
      bearishDrivers: JSON.parse(b.bearish_drivers || '[]')
    }))
  });
});

router.post('/briefs/generate', async (req, res) => {
  try {
    const symbol = req.body.symbol;
    if (symbol) {
      const inst = findInstrument(symbol);
      if (!inst) return res.status(404).json({ error: 'Instrument not found' });
      const brief = await generateDailyBrief(inst);
      return res.json({ briefs: [brief] });
    }
    const briefs = await generateAllBriefs(getAllInstruments());
    res.json({ briefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/decision-log', (req, res) => {
  res.json({ logs: getDecisionLogs() });
});

router.post('/decision-log', (req, res) => {
  const body = req.body;
  const id = addDecisionLog({
    createdAt: new Date().toISOString(),
    instrumentId: body.instrumentId,
    symbol: body.symbol,
    bias: body.bias,
    intendedAction: body.intendedAction,
    reason: body.reason,
    keyNewsItem: body.keyNewsItem,
    sentimentAtTime: body.sentimentAtTime,
    outcomeNotes: body.outcomeNotes
  });
  res.json({ id });
});

router.patch('/decision-log/:id', (req, res) => {
  updateDecisionLog(req.params.id, req.body.outcomeNotes || '');
  res.json({ ok: true });
});

router.get('/settings', (req, res) => {
  res.json({
    refreshIntervals: getApiProviders(),
    defaultInstrument: getSetting('defaultInstrument', getInstrumentsConfig().defaultInstrument),
    sentimentSensitivity: getSetting('sentimentSensitivity', 0.25),
    eventRiskSensitivity: getSetting('eventRiskSensitivity', 7),
    theme: getSetting('theme', 'dark'),
    apiKeysConfigured: {
      ALPHA_VANTAGE: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
      FINNHUB: Boolean(process.env.FINNHUB_API_KEY),
      FMP: Boolean(process.env.FMP_API_KEY),
      POLYGON: Boolean(process.env.POLYGON_API_KEY),
      NEWS_API: Boolean(process.env.NEWS_API_KEY)
    }
  });
});

router.post('/settings', (req, res) => {
  const { defaultInstrument, sentimentSensitivity, eventRiskSensitivity, theme } = req.body;
  if (defaultInstrument) setSetting('defaultInstrument', defaultInstrument);
  if (sentimentSensitivity != null) setSetting('sentimentSensitivity', sentimentSensitivity);
  if (eventRiskSensitivity != null) setSetting('eventRiskSensitivity', eventRiskSensitivity);
  if (theme) setSetting('theme', theme);
  res.json({ ok: true });
});

router.get('/config/credibility', (req, res) => {
  res.json(getSourceCredibility());
});

router.post('/cache/clear', (req, res) => {
  clearCache();
  res.json({ ok: true, message: 'Cache cleared' });
});

router.get('/config/export', (req, res) => {
  res.json({
    instruments: getInstrumentsConfig(),
    credibility: getSourceCredibility(),
    settings: {
      defaultInstrument: getSetting('defaultInstrument'),
      sentimentSensitivity: getSetting('sentimentSensitivity'),
      eventRiskSensitivity: getSetting('eventRiskSensitivity')
    }
  });
});

router.post('/political-events/manual', (req, res) => {
  addManualPoliticalEvent(req.body);
  res.json({ ok: true });
});

router.get('/political-events/manual', (req, res) => {
  res.json({ events: getManualPoliticalEvents() });
});

router.get('/backup/db', (req, res) => {
  if (fs.existsSync(DB_PATH)) {
    res.download(DB_PATH, `trader-news-backup-${Date.now()}.sqlite`);
  } else {
    res.status(404).json({ error: 'Database not found' });
  }
});

module.exports = router;
