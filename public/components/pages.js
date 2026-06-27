/* Additional pages */
window.TNC = window.TNC || {};

TNC.renderWatchlist = async function() {
  var el = document.getElementById('view-watchlist');
  el.innerHTML = '<div class="card"><div class="skeleton"></div></div>';
  try {
    var data = await TNC.fetchJSON('/watchlist');
    var watchlist = data.watchlist;
    el.innerHTML = '<div class="card"><div class="card-header"><span class="card-title">Watchlist</span>' +
      '<button class="btn btn-secondary" id="refreshWatchlist">Refresh All</button></div>' +
      '<table class="data-table"><thead><tr><th>Symbol</th><th>Name</th><th>Type</th><th>Price</th><th>Change</th>' +
      '<th>Sentiment</th><th>State</th></tr></thead><tbody>' +
      watchlist.map(function(w) {
        return '<tr data-symbol="' + TNC.escapeHtml(w.symbol) + '"><td><strong>' + TNC.escapeHtml(w.symbol) + '</strong></td>' +
          '<td>' + TNC.escapeHtml(w.name) + '</td><td>' + TNC.escapeHtml(w.assetType) + '</td>' +
          '<td>' + TNC.formatPrice(w.price, w.symbol) + '</td>' +
          '<td style="color:' + ((w.changePercent || 0) >= 0 ? 'var(--green)' : 'var(--red)') + '">' + TNC.formatPercent(w.changePercent) + '</td>' +
          '<td>' + TNC.escapeHtml(w.sentimentLabel) + '</td>' +
          '<td><span class="trade-state ' + w.decisionState + '">' + w.decisionState + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card" style="margin-top:1rem"><div class="card-header"><span class="card-title">Add Instrument</span></div>' +
      '<form id="addInstrumentForm"><div class="grid-3">' +
      '<div class="form-group"><label>Symbol</label><input name="symbol" required placeholder="AAPL"></div>' +
      '<div class="form-group"><label>Name</label><input name="displayName" required placeholder="Apple Inc"></div>' +
      '<div class="form-group"><label>Asset Type</label><select name="assetType"><option value="equity">Stock</option><option value="etf">ETF</option><option value="forex">Forex</option><option value="crypto">Crypto</option></select></div></div>' +
      '<button type="submit" class="btn">Add to Watchlist</button></form></div>';

    document.getElementById('refreshWatchlist').addEventListener('click', TNC.renderWatchlist);
    document.querySelectorAll('#view-watchlist tbody tr').forEach(function(row) {
      row.addEventListener('click', function() {
        window.dispatchEvent(new CustomEvent('select-instrument', { detail: row.dataset.symbol }));
      });
    });
    document.getElementById('addInstrumentForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      await TNC.fetchJSON('/instruments', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
      TNC.showToast('Instrument added');
      TNC.renderWatchlist();
      window.dispatchEvent(new CustomEvent('instruments-changed'));
    });
  } catch (err) {
    el.innerHTML = '<div class="empty-state">Failed: ' + TNC.escapeHtml(err.message) + '</div>';
  }
};

TNC.renderDailyBrief = async function() {
  var el = document.getElementById('view-brief');
  el.innerHTML = '<div class="card"><div class="card-header"><span class="card-title">Daily Trading Brief</span>' +
    '<button class="btn" id="generateBriefBtn">Generate Today\'s Brief</button></div>' +
    '<div id="briefContent"><div class="empty-state">Click Generate for favourite instruments</div></div></div>';

  document.getElementById('generateBriefBtn').addEventListener('click', async function() {
    var content = document.getElementById('briefContent');
    content.innerHTML = '<div class="skeleton"></div>';
    try {
      var data = await TNC.fetchJSON('/briefs/generate', { method: 'POST', body: '{}' });
      content.innerHTML = data.briefs.map(function(b) {
        return '<div class="card" style="margin-bottom:1rem;background:var(--bg-hover)"><h3>' + TNC.escapeHtml(b.symbol) + '</h3><p>' + TNC.escapeHtml(b.summary) + '</p></div>';
      }).join('');
      TNC.showToast('Generated ' + data.briefs.length + ' brief(s)');
    } catch (err) {
      content.innerHTML = '<div class="empty-state">' + TNC.escapeHtml(err.message) + '</div>';
    }
  });
};

TNC.renderDecisionLog = async function(currentSymbol, currentInstrument, dashboardData) {
  var el = document.getElementById('view-decision-log');
  var data = await TNC.fetchJSON('/decision-log').catch(function() { return { logs: [] }; });
  var logs = data.logs;

  el.innerHTML = '<div class="grid-dashboard"><div class="card"><div class="card-header"><span class="card-title">Log Decision</span></div>' +
    '<form id="decisionLogForm"><div class="form-group"><label>Instrument</label><input name="symbol" value="' + TNC.escapeHtml(currentSymbol || '') + '" readonly></div>' +
    '<div class="form-group"><label>My Bias</label><select name="bias"><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option></select></div>' +
    '<div class="form-group"><label>Intended Action</label><select name="intendedAction"><option value="watch">Watch</option><option value="long setup">Long setup</option><option value="short setup">Short setup</option><option value="no trade">No trade</option></select></div>' +
    '<div class="form-group"><label>Reason</label><textarea name="reason" rows="3"></textarea></div>' +
    '<button type="submit" class="btn">Save Entry</button></form></div>' +
    '<div class="card"><div class="card-header"><span class="card-title">History</span></div>' +
    (logs.length ? logs.map(function(l) {
      return '<div class="news-item"><div><strong>' + TNC.escapeHtml(l.symbol) + '</strong> · ' + TNC.formatDate(l.created_at) + '</div>' +
        '<div class="news-summary">' + TNC.escapeHtml(l.reason) + '</div></div>';
    }).join('') : '<div class="empty-state">No entries yet</div>') + '</div></div>';

  document.getElementById('decisionLogForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    await TNC.fetchJSON('/decision-log', {
      method: 'POST',
      body: JSON.stringify({
        instrumentId: (currentInstrument && currentInstrument.id) || fd.get('symbol'),
        symbol: fd.get('symbol'),
        bias: fd.get('bias'),
        intendedAction: fd.get('intendedAction'),
        reason: fd.get('reason'),
        sentimentAtTime: dashboardData && dashboardData.decision ? dashboardData.decision.overallSentiment : null
      })
    });
    TNC.showToast('Decision logged');
    TNC.renderDecisionLog(currentSymbol, currentInstrument, dashboardData);
  });
};

TNC.renderSettings = async function() {
  var el = document.getElementById('view-settings');
  var settings = await TNC.fetchJSON('/settings');
  var providers = await TNC.fetchJSON('/providers/status');

  el.innerHTML = '<div class="settings-grid">' +
    '<div class="card"><div class="card-header"><span class="card-title">API Key Status</span></div>' +
    '<p style="font-size:0.85rem;color:var(--text-secondary)">Set keys in .env file in the app folder.</p>' +
    Object.entries(settings.apiKeysConfigured).map(function(entry) {
      return '<div class="provider-status"><span class="status-dot ' + (entry[1] ? 'ready' : 'missing-key') + '"></span><span>' + entry[0] + ': ' + (entry[1] ? 'Configured' : 'Not set') + '</span></div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-header"><span class="card-title">Providers</span></div>' +
    Object.values(providers).map(function(p) {
      return '<div class="provider-status"><span class="status-dot ready"></span><span>' + TNC.escapeHtml(p.name) + ': ' + TNC.escapeHtml(p.message) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-header"><span class="card-title">Maintenance</span></div>' +
    '<button class="btn btn-secondary" id="clearCacheBtn">Clear Cache</button></div></div>';

  document.getElementById('clearCacheBtn').addEventListener('click', async function() {
    await TNC.fetchJSON('/cache/clear', { method: 'POST', body: '{}' });
    TNC.showToast('Cache cleared');
  });
};
