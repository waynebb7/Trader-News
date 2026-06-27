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

async function getDashboardData(instrument, forceRefresh = false) {
  addRecentInstrument(instrument.symbol);
  const config = getApiProviders();

  if (forceRefresh) {
    // Next fetch will miss cache if we don't implement clear-by-prefix; rely on TTL for now
  }

  const quoteResult = await tryAdapters(
    marketAdapters,
    'getQuote',
    instrument,
    'quote',
    config.marketData.refreshSeconds * 1000
  );

  const newsResult = await tryAdapters(
    newsAdapters,
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
  getProviderStatus
};
