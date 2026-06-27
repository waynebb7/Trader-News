const BaseAdapter = require('./baseAdapter');

function daysFromNow(days, hour = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function mockQuote(instrument) {
  const basePrices = { LMT: 485.20, RTX: 128.45, SPCX: 42.80, SPY: 545.30, 'EUR/USD': 1.0842, 'BTC/USD': 97250, GC: 2345.50 };
  const price = basePrices[instrument.symbol] || 100 + Math.random() * 50;
  const change = (Math.random() - 0.48) * 3;
  const prevClose = price / (1 + change / 100);
  return {
    symbol: instrument.symbol,
    price: Math.round(price * 100) / 100,
    change: Math.round((price - prevClose) * 100) / 100,
    changePercent: Math.round(change * 100) / 100,
    previousClose: Math.round(prevClose * 100) / 100,
    dayHigh: Math.round(price * 1.012 * 100) / 100,
    dayLow: Math.round(price * 0.988 * 100) / 100,
    week52High: Math.round(price * 1.18 * 100) / 100,
    week52Low: Math.round(price * 0.82 * 100) / 100,
    volume: Math.floor(1200000 + Math.random() * 800000),
    atr: Math.round(price * 0.018 * 100) / 100,
    gapStatus: change > 1.2 ? 'gap-up' : change < -1.2 ? 'gap-down' : 'none',
    marketStatus: 'Regular',
    preMarket: null,
    afterHours: null,
    swingHigh: Math.round(price * 1.05 * 100) / 100,
    swingLow: Math.round(price * 0.95 * 100) / 100,
    provider: 'mock',
    isMock: true,
    updatedAt: new Date().toISOString()
  };
}

function mockNews(instrument) {
  const sym = instrument.symbol;
  const items = [
    {
      id: `mock-1-${sym}`,
      headline: `${instrument.displayName} secures new defence contract worth $2.1B`,
      source: 'Defense News',
      url: 'https://www.defensenews.com/',
      summary: `Pentagon awards ${instrument.displayName} a multi-year contract for advanced systems delivery, boosting backlog visibility.`,
      publishedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: `mock-2-${sym}`,
      headline: `Analysts raise price target on ${sym} amid strong aerospace demand`,
      source: 'Reuters',
      url: 'https://www.reuters.com/',
      summary: 'Wall Street analysts cite improving margins and robust order pipeline in defence sector.',
      publishedAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: `mock-3-${sym}`,
      headline: 'White House schedules defence budget briefing this week',
      source: 'White House',
      url: 'https://www.whitehouse.gov/',
      summary: 'Administration officials expected to discuss military spending priorities and NATO commitments.',
      publishedAt: new Date(Date.now() - 14400000).toISOString()
    },
    {
      id: `mock-4-${sym}`,
      headline: `${sym} faces supply chain delays on key component — monitoring impact`,
      source: 'CNBC',
      url: 'https://www.cnbc.com/',
      summary: 'Company acknowledges minor delivery timeline adjustments; full-year guidance unchanged.',
      publishedAt: new Date(Date.now() - 28800000).toISOString()
    },
    {
      id: `mock-5-${sym}`,
      headline: 'Geopolitical tensions elevate defence sector sentiment',
      source: 'Bloomberg',
      url: 'https://www.bloomberg.com/',
      summary: 'European NATO members increase spending plans, potentially benefiting US defence contractors.',
      publishedAt: new Date(Date.now() - 43200000).toISOString()
    },
    {
      id: `mock-6-${sym}`,
      headline: `Social media rumour on ${sym} merger unconfirmed`,
      source: 'Twitter/X',
      url: 'https://twitter.com/',
      summary: 'Unverified posts circulating; no official company statement.',
      publishedAt: new Date(Date.now() - 1800000).toISOString()
    }
  ];
  return items;
}

function mockEarnings(instrument) {
  if (instrument.assetType !== 'equity' && instrument.assetType !== 'etf') return null;
  const daysUntil = instrument.symbol === 'LMT' ? 12 : instrument.symbol === 'RTX' ? 18 : 25;
  return {
    symbol: instrument.symbol,
    date: daysFromNow(daysUntil, 8),
    confirmed: instrument.symbol !== 'SPCX',
    time: 'before market',
    epsEstimate: 6.42,
    revenueEstimate: 18.2e9,
    previousEps: 6.15,
    previousRevenue: 17.8e9,
    surpriseHistory: ['beat', 'beat', 'inline', 'beat'],
    avgPostMove: 2.8,
    impliedMove: 3.2,
    daysUntil,
    provider: 'mock',
    isMock: true
  };
}

function mockEconomicEvents(instrument) {
  const events = [
    { eventName: 'FOMC Interest Rate Decision', country: 'US', dateTime: daysFromNow(3, 14), expectedImpact: 'Critical', category: 'central bank', whyItMatters: 'Rate path affects defence valuations and USD pairs.' },
    { eventName: 'CPI (YoY)', country: 'US', dateTime: daysFromNow(1, 13), expectedImpact: 'High', category: 'inflation', whyItMatters: 'Inflation data drives Fed expectations and risk appetite.' },
    { eventName: 'Non-Farm Payrolls', country: 'US', dateTime: daysFromNow(5, 13), expectedImpact: 'High', category: 'employment', whyItMatters: 'Labour market strength influences macro regime.' },
    { eventName: 'PMI Manufacturing', country: 'US', dateTime: daysFromNow(2, 15), expectedImpact: 'Medium', category: 'pmi', whyItMatters: 'Industrial activity proxy relevant to aerospace supply chains.' },
    { eventName: 'Defence Appropriations Markup', country: 'US', dateTime: daysFromNow(4, 10), expectedImpact: 'High', category: 'defence budget', whyItMatters: 'Direct relevance to defence contractor revenue outlook.' }
  ];
  return events.map(e => enrichEvent(e, instrument));
}

function mockPoliticalEvents() {
  const today = new Date();
  today.setHours(15, 0, 0, 0);
  return [
    {
      id: 'pol-1',
      eventName: 'President Trump Press Briefing',
      dateTime: today.toISOString(),
      source: 'White House (sample)',
      status: 'scheduled',
      relevanceTags: ['defence', 'tariff', 'trade', 'china'],
      description: 'Scheduled remarks — monitor for defence spending, tariff, and geopolitical comments.',
      isMock: true
    },
    {
      id: 'pol-2',
      eventName: 'NATO Defence Ministers Meeting',
      dateTime: daysFromNow(2, 11),
      source: 'Manual / sample',
      status: 'scheduled',
      relevanceTags: ['nato', 'defence', 'ukraine'],
      description: 'Alliance discussions on spending targets and aid packages.',
      isMock: true
    },
    {
      id: 'pol-3',
      eventName: 'Executive Order on Export Controls',
      dateTime: daysFromNow(6, 16),
      source: 'White House (sample)',
      status: 'unknown',
      relevanceTags: ['sanctions', 'china', 'defence'],
      description: 'Potential announcement affecting defence supply chain exports.',
      isMock: true
    }
  ].map(enrichPoliticalEvent);
}

function mockFilings(instrument) {
  if (!instrument.secCik) return [];
  return [
    { form: '10-K', filedDate: daysFromNow(-90), summary: 'Annual report — revenue growth in Aeronautics segment; increased R&D spend.', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${instrument.secCik}`, provider: 'mock' },
    { form: '10-Q', filedDate: daysFromNow(-30), summary: 'Quarterly report — backlog increased; margin pressure from supply chain noted.', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${instrument.secCik}`, provider: 'mock' },
    { form: '8-K', filedDate: daysFromNow(-2), summary: 'Material event — new contract announcement and leadership update.', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${instrument.secCik}`, provider: 'mock' }
  ];
}

function mockCompanyIR(instrument) {
  if (!instrument.irUrl) return { irUrl: null, items: [] };
  return {
    irUrl: instrument.irUrl,
    items: [
      { title: 'Q4 Earnings Release', type: 'press_release', date: daysFromNow(-45), url: instrument.irUrl, summary: 'Revenue beat; raised FY guidance; strong backlog.', isOfficial: true },
      { title: 'Investor Presentation — Aerospace Outlook', type: 'presentation', date: daysFromNow(-20), url: instrument.irUrl, summary: 'Management highlights defence demand and international expansion.', isOfficial: true },
      { title: 'Annual Shareholder Meeting Webcast', type: 'webcast', date: daysFromNow(30), url: instrument.irUrl, summary: 'Scheduled webcast for shareholders.', isOfficial: true }
    ],
    provider: 'mock',
    isMock: true
  };
}

function enrichEvent(e, instrument) {
  const dt = new Date(e.dateTime);
  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();
  return {
    ...e,
    isToday,
    countdownMs: dt - now,
    relevantInstruments: [instrument.symbol]
  };
}

function enrichPoliticalEvent(e) {
  const dt = new Date(e.dateTime);
  const now = new Date();
  return { ...e, isToday: dt.toDateString() === now.toDateString(), countdownMs: dt - now };
}

class MockAdapter extends BaseAdapter {
  constructor() {
    super('mock');
  }

  async getQuote(instrument) { return mockQuote(instrument); }
  async getNews(instrument) { return mockNews(instrument); }
  async getEarnings(instrument) { return mockEarnings(instrument); }
  async getEconomicCalendar(instrument) { return mockEconomicEvents(instrument); }
  async getPoliticalEvents() { return mockPoliticalEvents(); }
  async getFilings(instrument) { return mockFilings(instrument); }
  async getCompanyIR(instrument) { return mockCompanyIR(instrument); }

  getStatus() {
    return { name: 'mock', status: 'active', message: 'Sample data — configure API keys for live feeds' };
  }
}

module.exports = new MockAdapter();
module.exports.mockQuote = mockQuote;
module.exports.mockNews = mockNews;
