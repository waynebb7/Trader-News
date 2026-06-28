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
  var latestProviderResults = {};
  var configuredKeyCount = Object.values(settings.apiKeysConfigured).filter(Boolean).length;
  var providerCount = Object.keys(providers).length;
  var readyProviderCount = Object.values(providers).filter(function(p) {
    return p.status === 'ready' || p.status === 'active';
  }).length;

  el.innerHTML = '<div class="settings-grid">' +
    '<div class="card"><div class="card-header"><span class="card-title">Quick Start</span></div>' +
    '<div style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:0.6rem">Follow these steps in order:</div>' +
    '<div class="provider-status"><span class="status-dot ' + (configuredKeyCount ? 'ready' : 'missing-key') + '"></span><span><strong>1.</strong> Add API keys in .env (' + configuredKeyCount + '/5 set)</span></div>' +
    '<div class="provider-status"><span class="status-dot ready"></span><span><strong>2.</strong> Select an instrument using search or Watchlist</span></div>' +
    '<div class="provider-status"><span class="status-dot ' + (readyProviderCount === providerCount ? 'ready' : 'missing-key') + '"></span><span><strong>3.</strong> Check provider health (' + readyProviderCount + '/' + providerCount + ' ready)</span></div>' +
    '<div class="provider-status"><span class="status-dot ready"></span><span><strong>4.</strong> Click Refresh or press R to pull latest data</span></div>' +
    '<div class="provider-status"><span class="status-dot ready"></span><span><strong>5.</strong> Use Daily Brief for a concise summary</span></div>' +
    '<div style="margin-top:0.8rem;padding:0.6rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-hover);font-size:0.8rem;color:var(--text-muted)">Tip: Press / to focus search instantly.</div></div>' +
    '<div class="card"><div class="card-header"><span class="card-title">API Key Status</span></div>' +
    '<p style="font-size:0.85rem;color:var(--text-secondary)">Set keys in .env file in the app folder.</p>' +
    Object.entries(settings.apiKeysConfigured).map(function(entry) {
      return '<div class="provider-status"><span class="status-dot ' + (entry[1] ? 'ready' : 'missing-key') + '"></span><span>' + entry[0] + ': ' + (entry[1] ? 'Configured' : 'Not set') + '</span></div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-header"><span class="card-title">Providers</span></div>' +
    '<div class="provider-toolbar">' +
    '<button class="btn btn-secondary" id="testAllProvidersBtn">Test All Providers</button>' +
    '<button class="btn btn-secondary" id="downloadAllReportBtn">Download All Providers Report</button>' +
    '<button class="btn btn-secondary" id="downloadFailedReportBtn">Download Failed Report</button>' +
    '</div>' +
    Object.values(providers).map(function(p) {
      var dot = (p.status === 'ready' || p.status === 'active') ? 'ready' : (p.status || 'missing-key');
      return '<div class="provider-status provider-status-row">' +
        '<span class="status-dot ' + dot + '"></span>' +
        '<span class="provider-line"><strong>' + TNC.escapeHtml(p.name) + '</strong>: ' + TNC.escapeHtml(p.message) +
        '<span class="provider-test-result" id="providerTestResult-' + TNC.escapeHtml(p.name) + '"></span></span>' +
        '<div class="provider-actions">' +
        '<button class="btn btn-secondary provider-test-btn" data-provider="' + TNC.escapeHtml(p.name) + '">Test</button>' +
        '<button class="btn btn-secondary provider-copy-fix-btn" data-provider="' + TNC.escapeHtml(p.name) + '">Copy Fix</button>' +
        '</div>' +
        '</div>';
    }).join('') + '</div>' +
    '<div class="card"><div class="card-header"><span class="card-title">Maintenance</span></div>' +
    '<button class="btn btn-secondary" id="clearCacheBtn">Clear Cache</button> ' +
    '<button class="btn btn-secondary" id="reloadSettingsBtn">Refresh Status</button></div></div>';

  function formatTestResult(result) {
    if (!result) return '';
    var cls = result.status === 'pass' ? 'ok' : result.status === 'skipped' ? 'skip' : 'bad';
    var stamp = result.checkedAt ? new Date(result.checkedAt).toLocaleTimeString() : '';
    var msg = result.message || '';
    var hint = getProviderHint(result);
    return '<span class="' + cls + '">[' + result.status.toUpperCase() + ']</span> ' +
      TNC.escapeHtml(msg) +
      (stamp ? ' <span class="muted">at ' + TNC.escapeHtml(stamp) + '</span>' : '') +
      (hint ? '<div class="provider-fix-hint">Fix: ' + TNC.escapeHtml(hint) + '</div>' : '');
  }

  function getProviderHint(result) {
    if (!result || !result.status || result.status === 'pass') return '';

    var name = String(result.name || '').toLowerCase();
    var msg = String(result.message || '').toLowerCase();

    if (result.status === 'skipped' || msg.indexOf('missing api key') >= 0 || msg.indexOf('missing-key') >= 0) {
      return 'Add the matching key in .env, restart the server, then test again.';
    }

    if (name === 'alphavantage' && (msg.indexOf('rate limit') >= 0 || msg.indexOf('25 requests per day') >= 0)) {
      return 'Alpha Vantage free tier daily quota reached. Wait for reset or upgrade plan.';
    }

    if (name === 'fmp' && msg.indexOf('403') >= 0) {
      return 'FMP rejected the request (403). Verify key validity/plan permissions and endpoint access.';
    }

    if (msg.indexOf('timed out') >= 0) {
      return 'Network timeout. Retry shortly; if persistent, check firewall/DNS and internet access.';
    }

    if (msg.indexOf('401') >= 0 || msg.indexOf('403') >= 0 || msg.indexOf('unauthorized') >= 0 || msg.indexOf('forbidden') >= 0) {
      return 'Authentication/authorization issue. Recheck API key, account status, and allowed endpoints.';
    }

    if (msg.indexOf('429') >= 0 || msg.indexOf('too many') >= 0) {
      return 'Rate limited by provider. Wait and retry, reduce polling, or use a higher tier plan.';
    }

    return 'Retry test; if it still fails, clear cache and check provider status/messages in Settings.';
  }

  async function runProviderTest(provider) {
    var body = provider ? { provider: provider } : {};
    var response = await TNC.fetchJSON('/providers/test', { method: 'POST', body: JSON.stringify(body) });
    Object.keys(response.results || {}).forEach(function(name) {
      latestProviderResults[name] = response.results[name];
      var target = document.getElementById('providerTestResult-' + name);
      if (target) target.innerHTML = formatTestResult(response.results[name]);
    });
    return response;
  }

  async function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  function downloadTextFile(fileName, content) {
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getFailedOrSkippedResults() {
    return Object.keys(latestProviderResults)
      .map(function(name) { return latestProviderResults[name]; })
      .filter(function(result) { return result && (result.status === 'fail' || result.status === 'skipped'); });
  }

  function formatReportTimestamp(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    var ss = String(d.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + day + '_' + hh + '-' + mm + '-' + ss;
  }

  function buildReport(title, entries, generatedAt) {
    var passCount = entries.filter(function(r) { return r.status === 'pass'; }).length;
    var failCount = entries.filter(function(r) { return r.status === 'fail'; }).length;
    var skipCount = entries.filter(function(r) { return r.status === 'skipped'; }).length;

    var header = [
      title,
      'Generated: ' + generatedAt.toISOString(),
      'Entries: ' + entries.length,
      'Pass: ' + passCount,
      'Fail: ' + failCount,
      'Skipped: ' + skipCount,
      ''
    ].join('\n');

    var body = entries.map(function(result, idx) {
      var hint = getProviderHint(result) || 'No specific fix guidance available.';
      return [
        (idx + 1) + '. Provider: ' + (result.name || 'unknown'),
        '   Status: ' + String(result.status || 'unknown').toUpperCase(),
        '   Checked At: ' + (result.checkedAt || 'unknown'),
        '   Message: ' + String(result.message || 'No details'),
        '   Fix: ' + hint,
        ''
      ].join('\n');
    }).join('');

    return header + body;
  }

  document.getElementById('clearCacheBtn').addEventListener('click', async function() {
    await TNC.fetchJSON('/cache/clear', { method: 'POST', body: '{}' });
    TNC.showToast('Cache cleared');
  });

  document.getElementById('reloadSettingsBtn').addEventListener('click', function() {
    TNC.renderSettings();
    TNC.showToast('Status refreshed');
  });

  document.getElementById('testAllProvidersBtn').addEventListener('click', async function(e) {
    e.target.disabled = true;
    e.target.textContent = 'Testing...';
    try {
      await runProviderTest();
      TNC.showToast('Provider tests completed');
    } catch (err) {
      TNC.showToast('Provider test failed: ' + err.message, 'warning');
    } finally {
      e.target.disabled = false;
      e.target.textContent = 'Test All Providers';
    }
  });

  document.getElementById('downloadFailedReportBtn').addEventListener('click', function() {
    var failures = getFailedOrSkippedResults();
    if (!failures.length) {
      TNC.showToast('No failed/skipped providers to report. Run tests first.', 'warning');
      return;
    }

    var generatedAt = new Date();
    var report = buildReport('Trader News Cockpit - Provider Failure Report', failures, generatedAt);
    var fileName = 'provider-failure-report-' + formatReportTimestamp(generatedAt) + '.txt';
    downloadTextFile(fileName, report);
    TNC.showToast('Failed provider report downloaded');
  });

  document.getElementById('downloadAllReportBtn').addEventListener('click', function() {
    var all = Object.keys(latestProviderResults).map(function(name) {
      return latestProviderResults[name];
    }).filter(Boolean);

    if (!all.length) {
      TNC.showToast('No provider diagnostics available. Run tests first.', 'warning');
      return;
    }

    var generatedAt = new Date();
    var report = buildReport('Trader News Cockpit - All Provider Diagnostics Report', all, generatedAt);
    var fileName = 'provider-all-report-' + formatReportTimestamp(generatedAt) + '.txt';
    downloadTextFile(fileName, report);
    TNC.showToast('All provider report downloaded');
  });

  document.querySelectorAll('.provider-test-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var provider = btn.dataset.provider;
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Testing...';
      try {
        await runProviderTest(provider);
      } catch (err) {
        TNC.showToast(provider + ' test failed: ' + err.message, 'warning');
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  document.querySelectorAll('.provider-copy-fix-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var provider = btn.dataset.provider;
      var result = latestProviderResults[provider];
      if (!result) {
        TNC.showToast('Run a provider test first to generate fix steps.', 'warning');
        return;
      }

      var hint = getProviderHint(result) || 'No specific fix guidance available.';
      var summary = [
        'Provider: ' + provider,
        'Status: ' + String(result.status || 'unknown').toUpperCase(),
        'Message: ' + String(result.message || 'No details'),
        'Fix: ' + hint
      ].join('\n');

      try {
        await copyText(summary);
        TNC.showToast('Fix steps copied for ' + provider);
      } catch (err) {
        TNC.showToast('Could not copy fix steps: ' + err.message, 'warning');
      }
    });
  });
};
