const path = require('path');
const fs = require('fs');

function getDataDir() {
  if (process.env.TRADER_NEWS_DATA_DIR) {
    return process.env.TRADER_NEWS_DATA_DIR;
  }
  // Portable: data travels with the project folder (Windows PC ↔ MacBook)
  const portable = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(portable)) {
    fs.mkdirSync(portable, { recursive: true });
  }
  return portable;
}

const DATA_DIR = getDataDir();
const DB_PATH = path.join(DATA_DIR, 'trader-news.sqlite');

let db;
let useJsonFallback = false;
const jsonStorePath = path.join(DATA_DIR, 'store.json');

function loadJsonStore() {
  if (!fs.existsSync(jsonStorePath)) {
    return { cache: {}, settings: {}, recent: [], decisionLogs: [], dailyBriefs: [], customInstruments: [], manualPoliticalEvents: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(jsonStorePath, 'utf8'));
  } catch {
    return { cache: {}, settings: {}, recent: [], decisionLogs: [], dailyBriefs: [], customInstruments: [], manualPoliticalEvents: [] };
  }
}

function saveJsonStore(store) {
  fs.writeFileSync(jsonStorePath, JSON.stringify(store, null, 2), 'utf8');
}

function initDatabase() {
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = DELETE');
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        cache_key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        provider TEXT
      );
      CREATE TABLE IF NOT EXISTS decision_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        instrument_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        bias TEXT NOT NULL,
        intended_action TEXT NOT NULL,
        reason TEXT,
        key_news_item TEXT,
        sentiment_at_time REAL,
        outcome_notes TEXT,
        created_ts INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_briefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brief_date TEXT NOT NULL,
        instrument_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        summary TEXT NOT NULL,
        bullish_drivers TEXT,
        bearish_drivers TEXT,
        key_risk TEXT,
        next_event TEXT,
        recommendation TEXT,
        created_ts INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recent_instruments (symbol TEXT PRIMARY KEY, viewed_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS custom_instruments (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS manual_political_events (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, created_at INTEGER NOT NULL);
    `);
    console.log('  Database:', DB_PATH);
  } catch (err) {
    console.warn('  SQLite unavailable (' + err.message + ') — using JSON file storage.');
    useJsonFallback = true;
  }
}

initDatabase();

module.exports = {
  db,
  DB_PATH,
  DATA_DIR,
  useJsonFallback,

  getCache(key) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      const row = store.cache[key];
      if (!row) return null;
      if (Date.now() > row.expires_at) return { ...row, stale: true };
      return { ...row, data: row.data, stale: false };
    }
    const row = db.prepare('SELECT * FROM cache WHERE cache_key = ?').get(key);
    if (!row) return null;
    if (Date.now() > row.expires_at) return { ...row, stale: true };
    return { ...row, data: JSON.parse(row.data), stale: false };
  },

  setCache(key, data, ttlMs, provider = 'unknown') {
    const now = Date.now();
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.cache[key] = { data, fetched_at: now, expires_at: now + ttlMs, provider };
      saveJsonStore(store);
      return;
    }
    db.prepare(`
      INSERT INTO cache (cache_key, data, fetched_at, expires_at, provider) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at, provider=excluded.provider
    `).run(key, JSON.stringify(data), now, now + ttlMs, provider);
  },

  clearCache() {
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.cache = {};
      saveJsonStore(store);
      return;
    }
    db.prepare('DELETE FROM cache').run();
  },

  getSetting(key, defaultValue = null) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      return store.settings[key] !== undefined ? store.settings[key] : defaultValue;
    }
    const row = db.prepare('SELECT value FROM user_settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : defaultValue;
  },

  setSetting(key, value) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.settings[key] = value;
      saveJsonStore(store);
      return;
    }
    db.prepare('INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
  },

  addRecentInstrument(symbol) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.recent = store.recent.filter(s => s.symbol !== symbol);
      store.recent.unshift({ symbol, viewed_at: Date.now() });
      store.recent = store.recent.slice(0, 20);
      saveJsonStore(store);
      return;
    }
    db.prepare('INSERT INTO recent_instruments (symbol, viewed_at) VALUES (?, ?) ON CONFLICT(symbol) DO UPDATE SET viewed_at=excluded.viewed_at').run(symbol, Date.now());
  },

  getRecentInstruments(limit = 10) {
    if (useJsonFallback) {
      return loadJsonStore().recent.slice(0, limit);
    }
    return db.prepare('SELECT symbol FROM recent_instruments ORDER BY viewed_at DESC LIMIT ?').all(limit);
  },

  getDecisionLogs(limit = 100) {
    if (useJsonFallback) {
      return loadJsonStore().decisionLogs.slice(0, limit);
    }
    return db.prepare('SELECT * FROM decision_log ORDER BY created_ts DESC LIMIT ?').all(limit);
  },

  addDecisionLog(entry) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      const id = store.decisionLogs.length + 1;
      store.decisionLogs.unshift({
        id,
        created_at: entry.createdAt,
        instrument_id: entry.instrumentId,
        symbol: entry.symbol,
        bias: entry.bias,
        intended_action: entry.intendedAction,
        reason: entry.reason || '',
        key_news_item: entry.keyNewsItem || '',
        sentiment_at_time: entry.sentimentAtTime ?? null,
        outcome_notes: entry.outcomeNotes || '',
        created_ts: Date.now()
      });
      saveJsonStore(store);
      return id;
    }
    const result = db.prepare(`
      INSERT INTO decision_log (created_at, instrument_id, symbol, bias, intended_action, reason, key_news_item, sentiment_at_time, outcome_notes, created_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.createdAt, entry.instrumentId, entry.symbol, entry.bias, entry.intendedAction, entry.reason || '', entry.keyNewsItem || '', entry.sentimentAtTime ?? null, entry.outcomeNotes || '', Date.now());
    return result.lastInsertRowid;
  },

  updateDecisionLog(id, outcomeNotes) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      const row = store.decisionLogs.find(l => l.id === Number(id));
      if (row) row.outcome_notes = outcomeNotes;
      saveJsonStore(store);
      return;
    }
    db.prepare('UPDATE decision_log SET outcome_notes = ? WHERE id = ?').run(outcomeNotes, id);
  },

  saveDailyBrief(brief) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.dailyBriefs.unshift({
        id: store.dailyBriefs.length + 1,
        brief_date: brief.briefDate,
        instrument_id: brief.instrumentId,
        symbol: brief.symbol,
        summary: brief.summary,
        bullish_drivers: JSON.stringify(brief.bullishDrivers || []),
        bearish_drivers: JSON.stringify(brief.bearishDrivers || []),
        key_risk: brief.keyRisk || '',
        next_event: brief.nextEvent || '',
        recommendation: brief.recommendation || '',
        created_ts: Date.now()
      });
      saveJsonStore(store);
      return;
    }
    db.prepare(`
      INSERT INTO daily_briefs (brief_date, instrument_id, symbol, summary, bullish_drivers, bearish_drivers, key_risk, next_event, recommendation, created_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(brief.briefDate, brief.instrumentId, brief.symbol, brief.summary, JSON.stringify(brief.bullishDrivers || []), JSON.stringify(brief.bearishDrivers || []), brief.keyRisk || '', brief.nextEvent || '', brief.recommendation || '', Date.now());
  },

  getDailyBriefs(date = null, limit = 50) {
    if (useJsonFallback) {
      let list = loadJsonStore().dailyBriefs;
      if (date) list = list.filter(b => b.brief_date === date);
      return list.slice(0, limit);
    }
    if (date) return db.prepare('SELECT * FROM daily_briefs WHERE brief_date = ? ORDER BY created_ts DESC').all(date);
    return db.prepare('SELECT * FROM daily_briefs ORDER BY created_ts DESC LIMIT ?').all(limit);
  },

  getCustomInstruments() {
    if (useJsonFallback) {
      return loadJsonStore().customInstruments.map(r => typeof r === 'string' ? JSON.parse(r) : r.data ? JSON.parse(r.data) : r);
    }
    return db.prepare('SELECT * FROM custom_instruments ORDER BY created_at DESC').all().map(r => JSON.parse(r.data));
  },

  saveCustomInstrument(instrument) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      const idx = store.customInstruments.findIndex(i => (i.id || i.data?.id) === instrument.id);
      const entry = { id: instrument.id, data: JSON.stringify(instrument), created_at: Date.now() };
      if (idx >= 0) store.customInstruments[idx] = entry;
      else store.customInstruments.push(entry);
      saveJsonStore(store);
      return;
    }
    db.prepare('INSERT INTO custom_instruments (id, data, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(instrument.id, JSON.stringify(instrument), Date.now());
  },

  deleteCustomInstrument(id) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.customInstruments = store.customInstruments.filter(i => i.id !== id);
      saveJsonStore(store);
      return;
    }
    db.prepare('DELETE FROM custom_instruments WHERE id = ?').run(id);
  },

  getManualPoliticalEvents() {
    if (useJsonFallback) {
      return loadJsonStore().manualPoliticalEvents.map(r => typeof r === 'string' ? JSON.parse(r) : r.data ? JSON.parse(r.data) : r);
    }
    return db.prepare('SELECT * FROM manual_political_events ORDER BY created_at DESC').all().map(r => JSON.parse(r.data));
  },

  addManualPoliticalEvent(event) {
    if (useJsonFallback) {
      const store = loadJsonStore();
      store.manualPoliticalEvents.push({ data: JSON.stringify(event), created_at: Date.now() });
      saveJsonStore(store);
      return;
    }
    db.prepare('INSERT INTO manual_political_events (data, created_at) VALUES (?, ?)').run(JSON.stringify(event), Date.now());
  }
};
