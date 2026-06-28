const cacheManager = require('../cache/cacheManager');
const { getApiProviders } = require('../server/configLoader');
const { enrichNewsItem } = require('../nlp/sentimentEngine');
const { computeTradeReadiness, generateAlerts } = require('../scoring/tradeReadiness');
const { addRecentInstrument } = require('../db/database');

const finnhub = require('../adapters/finnhubAdapter');
const alphaVantage = require('../adapters/alphaVantageAdapter');
const fmp = require('../adapters/fmpAdapter');
const newsApi = require('../adapters/newsApiAdapter');
const secEdgar = require('../adapters/secEdgarAdapter');
const politicalEvents = require('../adapters/politicalEventsAdapter');
const companyIR = require('../adapters/companyIRAdapter');
const mock = require('../adapters/mockAdapter');

const marketAdapters = [finnhub, alphaVantage, fmp, mock];
const newsAdapters = [finnhub, newsApi, fmp, mock];

function getMarketAdaptersForInstrument(instrument) {
  const isFxInstrument = instrument && (instrument.assetType === 'forex' || instrument.sector === 'fx');
  if (isFxInstrument) {
    // Prefer Alpha Vantage FX endpoint for EUR/USD and 6E proxy.
    return [alphaVantage, finnhub, fmp, mock];
  }
  return marketAdapters;
}

function getNewsAdaptersForInstrument(instrument) {
  const isFxInstrument = instrument && (instrument.assetType === 'forex' || instrument.sector === 'fx');
  if (isFxInstrument) {
    return [newsApi, finnhub, fmp, mock];
  }
  return newsAdapters;
}

async function tryAdapters(adapters, method, instrument, ttlKey, ttlMs) {
  const errors = [];
  for (const adapter of adapters) {
    if (method !== 'getQuote' && adapter === mock) continue;
    if (!adapter.isConfigured?.() && adapter !== mock) {
      errors.push({ provider: adapter.name, error: 'missing-key' });
      continue;
    }
    try {
      const cacheKey = `${ttlKey}:${adapter.name}:${instrument.symbol}`;
      const result = await cacheManager.getOrFetch(
        cacheKey,
        ttlMs,
        () => adapter[method](instrument),
        adapter.name
      );
      return { ...result, usedProvider: adapter.name };
    } catch (err) {
      errors.push({ provider: adapter.name, error: err.message });
    }
  }
  const fallback = await mock[method](instrument);
  return { data: fallback, fromCache: false, usedProvider: 'mock', errors };
}

function getProviderStatus() {
  const providers = [
    finnhub, alphaVantage, fmp, newsApi, secEdgar, politicalEvents, companyIR, mock
  ];
  const status = {};
  for (const p of providers) {
    status[p.name] = p.getStatus();
  }
  return status;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]);
}

function sanitizeDiagnosticMessage(message) {
  let text = String(message || 'Unknown error');
  const possibleSecrets = [
    process.env.ALPHA_VANTAGE_API_KEY,
    process.env.FINNHUB_API_KEY,
    process.env.FMP_API_KEY,
    process.env.NEWS_API_KEY,
    process.env.POLYGON_API_KEY
  ].filter(Boolean);

  for (const secret of possibleSecrets) {
    if (secret) text = text.split(secret).join('[REDACTED]');
  }

  return text.slice(0, 400);
}

async function probeProvider(name, instruments = {}) {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  const equity = instruments.equity || { symbol: 'LMT', displayName: 'Lockheed Martin', assetType: 'equity' };
  const filingInstrument = instruments.filing || { ...equity, secCik: '0000936468' };
  const irInstrument = instruments.ir || { ...equity, irUrl: 'https://investors.lockheedmartin.com/' };

  const probes = {
    finnhub: async () => {
      if (!finnhub.isConfigured()) return { status: 'skipped', message: 'Missing API key' };
      await finnhub.getQuote(equity);
      return { status: 'pass', message: 'Quote request succeeded' };
    },
    alphaVantage: async () => {
      if (!alphaVantage.isConfigured()) return { status: 'skipped', message: 'Missing API key' };
      await alphaVantage.getQuote(equity);
      return { status: 'pass', message: 'Quote request succeeded' };
    },
    fmp: async () => {
      if (!fmp.isConfigured()) return { status: 'skipped', message: 'Missing API key' };
      await fmp.getQuote(equity);
      return { status: 'pass', message: 'Quote request succeeded' };
    },
    newsApi: async () => {
      if (!newsApi.isConfigured()) return { status: 'skipped', message: 'Missing API key' };
      await newsApi.getNews(equity);
      return { status: 'pass', message: 'News request succeeded' };
    },
    secEdgar: async () => {
      await secEdgar.getFilings(filingInstrument);
      return { status: 'pass', message: 'Filings request succeeded' };
    },
    politicalEvents: async () => {
      await politicalEvents.getPoliticalEvents();
      return { status: 'pass', message: 'Political feed request succeeded' };
    },
    companyIR: async () => {
      await companyIR.getCompanyIR(irInstrument);
      return { status: 'pass', message: 'IR request succeeded' };
    },
    mock: async () => {
      await mock.getQuote(equity);
      return { status: 'pass', message: 'Mock provider available' };
    }
  };

  const probe = probes[name];
  if (!probe) {
    return {
      name,
      status: 'fail',
      message: 'Unknown provider',
      checkedAt,
      latencyMs: Date.now() - startedAt
    };
  }

  try {
    const result = await withTimeout(probe(), 12000, `${name} probe`);
    return {
      name,
      status: result.status,
      message: result.message,
      checkedAt,
      latencyMs: Date.now() - startedAt
    };
  } catch (err) {
    return {
      name,
      status: 'fail',
      message: sanitizeDiagnosticMessage(err.message),
      checkedAt,
      latencyMs: Date.now() - startedAt
    };
  }
}

async function runProviderDiagnostics(providerName, instruments = {}) {
  const allNames = ['finnhub', 'alphaVantage', 'fmp', 'newsApi', 'secEdgar', 'politicalEvents', 'companyIR', 'mock'];
  const names = providerName ? [providerName] : allNames;
  const results = {};

  for (const name of names) {
    results[name] = await probeProvider(name, instruments);
  }

  return results;
}

async function getDashboardData(instrument, forceRefresh = false) {
  addRecentInstrument(instrument.symbol);
  const config = getApiProviders();

  if (forceRefresh) {
    // Next fetch will miss cache if we don't implement clear-by-prefix; rely on TTL for now
  }

  const quoteResult = await tryAdapters(
    getMarketAdaptersForInstrument(instrument),
    'getQuote',
    instrument,
    'quote',
    config.marketData.refreshSeconds * 1000
  );

  const newsResult = await tryAdapters(
    getNewsAdaptersForInstrument(instrument),
    'getNews',
    instrument,
    'news',
    config.news.refreshSeconds * 1000
  );

  let earnings = null;
  try {
    const er = await cacheManager.getOrFetch(
      `earnings:${instrument.symbol}`,
      config.earnings.refreshSeconds * 1000,
      async () => {
        if (fmp.isConfigured()) return fmp.getEarnings(instrument);
        if (finnhub.isConfigured()) return finnhub.getEarnings(instrument);
        return mock.getEarnings(instrument);
      },
      fmp.isConfigured() ? 'fmp' : 'mock'
    );
    earnings = er.data;
  } catch {
    earnings = await mock.getEarnings(instrument);
  }

  let economicEvents = [];
  try {
    const ec = await cacheManager.getOrFetch(
      `econ:${instrument.symbol}`,
      config.economicCalendar.refreshSeconds * 1000,
      async () => {
        if (fmp.isConfigured()) return fmp.getEconomicCalendar(instrument);
        return mock.getEconomicCalendar(instrument);
      },
      fmp.isConfigured() ? 'fmp' : 'mock'
    );
    economicEvents = ec.data || [];
  } catch {
    economicEvents = await mock.getEconomicCalendar(instrument);
  }

  let political = [];
  try {
    const pe = await cacheManager.getOrFetch(
      'political:all',
      config.politicalEvents.refreshSeconds * 1000,
      () => politicalEvents.getPoliticalEvents(),
      'politicalEvents'
    );
    political = pe.data || [];
  } catch {
    political = await mock.getPoliticalEvents();
  }

  let filings = [];
  try {
    const fl = await cacheManager.getOrFetch(
      `filings:${instrument.symbol}`,
      config.secFilings.refreshSeconds * 1000,
      async () => {
        if (instrument.secCik) return secEdgar.getFilings(instrument);
        return mock.getFilings(instrument);
      },
      instrument.secCik ? 'secEdgar' : 'mock'
    );
    filings = fl.data || [];
  } catch {
    filings = await mock.getFilings(instrument);
  }

  let irData = { irUrl: instrument.irUrl, items: [] };
  try {
    const ir = await cacheManager.getOrFetch(
      `ir:${instrument.symbol}`,
      config.companyIR.refreshSeconds * 1000,
      () => companyIR.getCompanyIR(instrument),
      'companyIR'
    );
    irData = ir.data;
  } catch {
    irData = await mock.getCompanyIR(instrument);
  }

  const rawNews = newsResult.data || [];
  const newsItems = rawNews.map(item => enrichNewsItem(item, instrument));

  const priceData = quoteResult.data || {};
  const providerStatus = getProviderStatus();

  const dataFreshness = {
    quote: quoteResult.fetchedAt,
    news: newsResult.fetchedAt,
    stale: quoteResult.stale || newsResult.stale || false
  };

  const alerts = generateAlerts({
    newsItems,
    priceData,
    earnings,
    economicEvents,
    politicalEvents: political,
    providerStatus,
    dataFreshness
  });

  const decision = computeTradeReadiness({
    newsItems,
    priceData,
    earnings,
    economicEvents,
    politicalEvents: political,
    alerts
  });

  const irItems = (irData.items || []).map(item => {
    const enriched = enrichNewsItem({
      headline: item.title,
      summary: item.summary,
      source: 'Company IR',
      url: item.url,
      publishedAt: item.date
    }, instrument);
    return { ...item, ...enriched, isOfficial: true, promotionalWarning: 'Official company release — may be promotional' };
  });

  return {
    instrument,
    quote: priceData,
    news: newsItems,
    earnings,
    economicEvents,
    politicalEvents: political,
    filings,
    companyIR: { ...irData, items: irItems },
    decision,
    alerts,
    providerStatus,
    dataFreshness,
    meta: {
      quoteProvider: quoteResult.usedProvider,
      newsProvider: newsResult.usedProvider,
      isMockData: priceData.isMock || newsItems.some(n => n.provider === 'mock'),
      updatedAt: new Date().toISOString()
    }
  };
}

async function getWatchlistData(instruments) {
  const results = [];
  for (const inst of instruments) {
    try {
      const dash = await getDashboardData(inst);
      results.push({
        symbol: inst.symbol,
        name: inst.displayName,
        assetType: inst.assetType,
        price: dash.quote.price,
        changePercent: dash.quote.changePercent,
        sentiment: dash.decision.overallSentiment,
        sentimentLabel: dash.decision.marketRead,
        newsCountToday: dash.news.filter(n => n.timeSensitivity !== 'Old').length,
        highImpactCount: dash.news.filter(n => ['High', 'Critical'].includes(n.marketImpact)).length,
        nextEvent: dash.decision.keyEventRisk || dash.earnings?.date || '—',
        earningsDate: dash.earnings?.date || '—',
        decisionState: dash.decision.tradeState,
        lastUpdated: dash.meta.updatedAt,
        favourite: inst.favourite
      });
    } catch {
      results.push({
        symbol: inst.symbol,
        name: inst.displayName,
        assetType: inst.assetType,
        price: null,
        changePercent: null,
        sentiment: 0,
        sentimentLabel: 'Unknown',
        newsCountToday: 0,
        highImpactCount: 0,
        nextEvent: '—',
        earningsDate: '—',
        decisionState: 'GREY',
        lastUpdated: null,
        favourite: inst.favourite,
        error: true
      });
    }
  }
  return results;
}

module.exports = {
  getDashboardData,
  getWatchlistData,
  getProviderStatus,
  runProviderDiagnostics
};
