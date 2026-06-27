/* Trader News Cockpit — main app */
(function() {
  var state = {
    instruments: [],
    recent: [],
    currentSymbol: 'LMT',
    currentView: 'dashboard',
    dashboardData: null,
    eventSource: null
  };

  async function loadInstruments() {
    var data = await TNC.fetchJSON('/instruments');
    state.instruments = data.instruments;
    state.recent = data.recent || [];
  }

  function getCurrentInstrument() {
    return state.instruments.find(function(i) { return i.symbol === state.currentSymbol; });
  }

  function renderInstrumentDropdown(filter) {
    filter = filter || '';
    var dropdown = document.getElementById('selectorDropdown');
    var lower = filter.toLowerCase();
    var list = state.instruments.filter(function(i) {
      return !lower || i.symbol.toLowerCase().includes(lower) || i.displayName.toLowerCase().includes(lower);
    });

    var html = list.slice(0, 20).map(function(i) {
      return '<div class="selector-item" data-symbol="' + TNC.escapeHtml(i.symbol) + '"><span><span class="sym">' +
        TNC.escapeHtml(i.symbol) + '</span> ' + TNC.escapeHtml(i.displayName) + '</span><span class="meta">' +
        TNC.escapeHtml(i.assetType) + '</span></div>';
    }).join('');

    dropdown.innerHTML = html || '<div class="selector-item">No matches</div>';
    dropdown.classList.remove('hidden');
    dropdown.querySelectorAll('.selector-item[data-symbol]').forEach(function(el) {
      el.addEventListener('click', function() { selectInstrument(el.dataset.symbol); });
    });
  }

  async function loadDashboard(force) {
    try {
      var url = '/dashboard/' + encodeURIComponent(state.currentSymbol) + (force ? '?refresh=true' : '');
      var data = await TNC.fetchJSON(url);
      state.dashboardData = data;
      TNC.renderStatusBar(data);
      TNC.renderAlerts(data.alerts);
      if (state.currentView === 'dashboard') TNC.renderDashboard(data);
      if (state.currentView === 'news') TNC.renderNewsView(data);
      if (state.currentView === 'calendar') TNC.renderCalendarView(data);
      if (state.currentView === 'filings') TNC.renderFilingsView(data);
    } catch (err) {
      TNC.showToast('Failed to load: ' + err.message, 'warning');
      document.getElementById('view-dashboard').innerHTML =
        '<div class="card empty-state"><h3>Could not connect to server</h3><p>Make sure you started the app with START_TRADER_NEWS.bat</p><p style="color:var(--red)">' + TNC.escapeHtml(err.message) + '</p></div>';
    }
  }

  function selectInstrument(symbol) {
    state.currentSymbol = symbol;
    var inst = getCurrentInstrument();
    document.getElementById('instrumentSearch').value = inst ? inst.symbol + ' — ' + inst.displayName : symbol;
    document.getElementById('selectorDropdown').classList.add('hidden');
    loadDashboard();
    connectSSE();
  }

  function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(function(v) {
      v.classList.toggle('active', v.id === 'view-' + view);
    });

    if (['dashboard', 'news', 'calendar', 'filings'].indexOf(view) >= 0 && state.dashboardData) {
      if (view === 'dashboard') TNC.renderDashboard(state.dashboardData);
      if (view === 'news') TNC.renderNewsView(state.dashboardData);
      if (view === 'calendar') TNC.renderCalendarView(state.dashboardData);
      if (view === 'filings') TNC.renderFilingsView(state.dashboardData);
    } else if (view === 'watchlist') TNC.renderWatchlist();
    else if (view === 'brief') TNC.renderDailyBrief();
    else if (view === 'decision-log') TNC.renderDecisionLog(state.currentSymbol, getCurrentInstrument(), state.dashboardData);
    else if (view === 'settings') TNC.renderSettings();
  }

  function connectSSE() {
    if (state.eventSource) state.eventSource.close();
    state.eventSource = new EventSource('/api/events?symbol=' + encodeURIComponent(state.currentSymbol));
    state.eventSource.onmessage = function(ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'update' && msg.payload && state.dashboardData) {
          state.dashboardData.quote = msg.payload.quote;
          state.dashboardData.decision = msg.payload.decision;
          state.dashboardData.alerts = msg.payload.alerts;
          TNC.renderStatusBar(state.dashboardData);
          TNC.renderAlerts(msg.payload.alerts);
          if (state.currentView === 'dashboard') TNC.renderDashboard(state.dashboardData);
        }
      } catch (e) { /* ignore */ }
    };
  }

  async function init() {
    document.getElementById('mainNav').addEventListener('click', function(e) {
      var btn = e.target.closest('.nav-btn');
      if (btn) switchView(btn.dataset.view);
    });

    var input = document.getElementById('instrumentSearch');
    input.addEventListener('focus', function() { renderInstrumentDropdown(input.value.split('—')[0].trim()); });
    input.addEventListener('input', function() { renderInstrumentDropdown(input.value); });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.instrument-selector')) {
        document.getElementById('selectorDropdown').classList.add('hidden');
      }
    });

    document.getElementById('refreshBtn').addEventListener('click', function() {
      loadDashboard(true);
      TNC.showToast('Refreshing...');
    });

    window.addEventListener('select-instrument', function(e) {
      selectInstrument(e.detail);
      switchView('dashboard');
    });

    await loadInstruments();
    selectInstrument(state.currentSymbol || 'LMT');
    setInterval(function() { loadDashboard(); }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
