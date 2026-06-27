/* Dashboard rendering */
window.TNC = window.TNC || {};

TNC.renderStatusBar = function(data) {
  var el = document.getElementById('statusBar');
  if (!data) { el.innerHTML = '<div class="skeleton" style="width:100%;height:24px"></div>'; return; }
  var q = data.quote || {};
  var d = data.decision || {};
  var pos = (q.changePercent || 0) >= 0;
  el.innerHTML =
    '<div class="status-item"><span class="label">Instrument</span><span class="value">' + TNC.escapeHtml(data.instrument.displayName) + ' (' + TNC.escapeHtml(data.instrument.symbol) + ')</span></div>' +
    '<div class="status-item ' + (pos ? 'positive' : 'negative') + '"><span class="label">Price</span><span class="value">' + TNC.formatPrice(q.price, data.instrument.symbol) + '</span></div>' +
    '<div class="status-item ' + (pos ? 'positive' : 'negative') + '"><span class="label">Change</span><span class="value">' + TNC.formatPercent(q.changePercent) + '</span></div>' +
    '<div class="status-item"><span class="label">Market</span><span class="value">' + TNC.escapeHtml(q.marketStatus || '—') + '</span></div>' +
    '<div class="status-item"><span class="label">Updated</span><span class="value">' + TNC.formatDate(data.meta && data.meta.updatedAt) + '</span></div>' +
    '<div class="status-item"><span class="label">Sentiment</span><span class="value">' + ((d.overallSentiment != null ? d.overallSentiment : 0).toFixed(2)) + '</span></div>' +
    '<div class="status-item"><span class="label">Readiness</span><span class="trade-state ' + (d.tradeState || 'GREY') + '">' + (d.tradeState || 'GREY') + '</span></div>' +
    '<div class="status-item"><span class="label">Provider</span><span class="value">' + TNC.escapeHtml((data.meta && data.meta.quoteProvider) || '—') + (data.meta && data.meta.isMockData ? ' (sample)' : '') + '</span></div>';
};

TNC.renderAlerts = function(alerts) {
  var el = document.getElementById('alertsBar');
  if (!alerts || !alerts.length) { el.innerHTML = ''; return; }
  el.innerHTML = alerts.slice(0, 8).map(function(a) {
    return '<span class="alert-chip ' + a.severity + '">' + TNC.escapeHtml(a.message) + '</span>';
  }).join('');
};

TNC.renderDashboard = function(data) {
  var el = document.getElementById('view-dashboard');
  if (!data) { el.innerHTML = '<div class="grid-dashboard"><div class="card"><div class="skeleton"></div></div></div>'; return; }
  var d = data.decision;
  var q = data.quote;
  var readClass = TNC.marketReadClass(d.marketRead);
  el.innerHTML =
    (data.meta && data.meta.isMockData ? '<div class="mock-banner">Sample data mode — add API keys in .env for live feeds</div>' : '') +
    '<div class="grid-dashboard"><section class="card decision-cockpit">' +
    '<div class="card-header"><span class="card-title">Decision Cockpit</span><span class="trade-state ' + d.tradeState + '">' + d.tradeState + '</span></div>' +
    '<div class="market-read ' + readClass + '">' + TNC.escapeHtml(d.marketRead) + '</div><div>Confidence: ' + d.confidence + '%</div>' +
    '<div class="confidence-bar"><div class="confidence-fill" style="width:' + d.confidence + '%"></div></div>' +
    '<div class="grid-3"><div><strong style="color:var(--green)">Top Bullish Drivers</strong><ul class="driver-list bullish">' +
    ((d.bullishDrivers || []).map(function(x) { return '<li>' + TNC.escapeHtml(x) + '</li>'; }).join('') || '<li>None identified</li>') +
    '</ul></div><div><strong style="color:var(--red)">Top Bearish Drivers</strong><ul class="driver-list bearish">' +
    ((d.bearishDrivers || []).map(function(x) { return '<li>' + TNC.escapeHtml(x) + '</li>'; }).join('') || '<li>None identified</li>') +
    '</ul></div><div><strong style="color:var(--grey)">Noise / Neutral</strong><ul class="driver-list">' +
    ((d.neutralNoise || []).map(function(x) { return '<li>' + TNC.escapeHtml(x) + '</li>'; }).join('') || '<li>None</li>') +
    '</ul></div></div>' +
    (d.keyEventRisk ? '<div style="margin-top:0.75rem;color:var(--amber)"><strong>Event Risk:</strong> ' + TNC.escapeHtml(d.keyEventRisk) + '</div>' : '') +
    '<div class="suggested-action">Suggested Action: ' + TNC.escapeHtml(d.suggestedAction) + '</div>' +
    '<div class="disclaimer-small">' + TNC.escapeHtml(d.disclaimer) + '</div></section>' +
    '<section class="card"><div class="card-header"><span class="card-title">Price & Levels</span><span class="card-badge">' + TNC.escapeHtml(q.gapStatus || 'no gap') + '</span></div>' +
    '<div class="price-big" style="color:' + ((q.changePercent || 0) >= 0 ? 'var(--green)' : 'var(--red)') + '">' + TNC.formatPrice(q.price, data.instrument.symbol) + ' <span style="font-size:1rem">' + TNC.formatPercent(q.changePercent) + '</span></div>' +
    '<div>Volume: ' + (q.volume != null ? q.volume.toLocaleString() : '—') + ' | ATR: ' + (q.atr != null ? q.atr : '—') + '</div>' +
    '<div class="levels-grid">' +
    ['Prev Close', q.previousClose, 'Day High', q.dayHigh, 'Day Low', q.dayLow, '52W High', q.week52High, '52W Low', q.week52Low].reduce(function(h, _, i, a) {
      if (i % 2 === 0) return h;
      return h;
    }, '') +
    '<div class="level-item"><span class="lbl">Prev Close</span><span class="val">' + TNC.formatPrice(q.previousClose) + '</span></div>' +
    '<div class="level-item"><span class="lbl">Day High</span><span class="val">' + TNC.formatPrice(q.dayHigh) + '</span></div>' +
    '<div class="level-item"><span class="lbl">Day Low</span><span class="val">' + TNC.formatPrice(q.dayLow) + '</span></div>' +
    '<div class="level-item"><span class="lbl">52W High</span><span class="val">' + TNC.formatPrice(q.week52High) + '</span></div>' +
    '<div class="level-item"><span class="lbl">52W Low</span><span class="val">' + TNC.formatPrice(q.week52Low) + '</span></div>' +
    '<div class="level-item"><span class="lbl">Swing H/L</span><span class="val">' + TNC.formatPrice(q.swingHigh) + ' / ' + TNC.formatPrice(q.swingLow) + '</span></div></div>' +
    '<div class="chart-placeholder">Intraday chart — configure FINNHUB or FMP API key for live chart data.</div></section>' +
    '<section class="card"><div class="card-header"><span class="card-title">Latest News</span><span class="card-badge">' + (data.news || []).length + ' items</span></div>' +
    '<div class="news-list">' + ((data.news || []).slice(0, 5).map(TNC.renderNewsItem).join('') || '<div class="empty-state">No news</div>') + '</div></section>' +
    '<section class="card"><div class="card-header"><span class="card-title">Earnings</span></div>' +
    (data.earnings ?
      '<div><strong>' + TNC.formatDate(data.earnings.date) + '</strong> (' + data.earnings.daysUntil + ' days) — ' + TNC.escapeHtml(data.earnings.time) + '</div>' +
      (data.earnings.daysUntil <= 7 ? '<div style="color:var(--amber);margin-top:0.5rem;font-weight:600">⚠ Earnings risk: avoid new trade unless part of your plan</div>' : '')
      : '<div class="empty-state">No earnings data</div>') + '</section>' +
    '<section class="card"><div class="card-header"><span class="card-title">Upcoming Macro</span></div>' +
    '<div class="event-list">' + ((data.economicEvents || []).slice(0, 4).map(TNC.renderEventItem).join('') || '<div class="empty-state">No events</div>') + '</div></section>' +
    '<section class="card"><div class="card-header"><span class="card-title">Political / White House</span></div>' +
    '<div class="event-list">' + ((data.politicalEvents || []).slice(0, 4).map(function(e) {
      return '<div class="event-item"><div class="event-date">' + TNC.formatDate(e.dateTime) + '</div><div><strong>' + TNC.escapeHtml(e.eventName) + '</strong>' +
        '<div style="font-size:0.8rem;color:var(--text-secondary)">' + TNC.escapeHtml(e.description || '') + '</div></div>' +
        '<div><span class="badge amber">' + TNC.escapeHtml(e.status || 'unknown') + '</span></div></div>';
    }).join('') || '<div class="empty-state">No political events</div>') + '</div></section></div>';
};

TNC.renderNewsView = function(data) {
  var el = document.getElementById('view-news');
  if (!data) { el.innerHTML = '<div class="skeleton"></div>'; return; }
  el.innerHTML = '<div class="card"><div class="card-header"><span class="card-title">News Intelligence — ' + TNC.escapeHtml(data.instrument.symbol) + '</span></div>' +
    '<div class="news-list">' + ((data.news || []).map(TNC.renderNewsItem).join('') || '<div class="empty-state">No news</div>') + '</div></div>';
};

TNC.renderCalendarView = function(data) {
  var el = document.getElementById('view-calendar');
  if (!data) { el.innerHTML = '<div class="skeleton"></div>'; return; }
  el.innerHTML = '<div class="grid-dashboard"><div class="card"><div class="card-header"><span class="card-title">Economic Calendar</span></div>' +
    '<div class="event-list">' + ((data.economicEvents || []).map(TNC.renderEventItem).join('') || '<div class="empty-state">No events</div>') + '</div></div>' +
    '<div class="card"><div class="card-header"><span class="card-title">Political Events</span></div>' +
    '<div class="event-list">' + ((data.politicalEvents || []).map(TNC.renderEventItem).join('') || '<div class="empty-state">No events</div>') + '</div></div></div>';
};

TNC.renderFilingsView = function(data) {
  var el = document.getElementById('view-filings');
  if (!data) { el.innerHTML = '<div class="skeleton"></div>'; return; }
  el.innerHTML = '<div class="card"><div class="card-header"><span class="card-title">SEC Filings — ' + TNC.escapeHtml(data.instrument.symbol) + '</span></div>' +
    '<div class="filing-warning">⚠ Read original filings for decisions. Summaries may miss context.</div>' +
    ((data.filings || []).length ? (data.filings || []).map(function(f) {
      return '<div class="event-item"><div><span class="badge green">' + TNC.escapeHtml(f.form) + '</span></div><div>' + TNC.formatDate(f.filedDate) +
        '<div style="font-size:0.85rem;color:var(--text-secondary)">' + TNC.escapeHtml(f.summary) + '</div>' +
        (f.url ? '<a href="' + TNC.escapeHtml(f.url) + '" target="_blank" rel="noopener" style="color:var(--accent)">View filing →</a>' : '') + '</div></div>';
    }).join('') : '<div class="empty-state">No SEC filings configured</div>') + '</div>';
};
