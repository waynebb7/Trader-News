/* Trader News Cockpit — main app */
(function() {
  var state = {
    instruments: [],
    recent: [],
    currentSymbol: 'LMT',
    currentView: 'dashboard',
    dashboardData: null,
    eventSource: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    streamState: 'connecting'
  };

  function persistState() {
    try {
      localStorage.setItem('tnc.currentSymbol', state.currentSymbol || 'LMT');
      localStorage.setItem('tnc.currentView', state.currentView || 'dashboard');
    } catch (e) { /* ignore storage errors */ }
  }

  function restoreState() {
    try {
      var savedSymbol = localStorage.getItem('tnc.currentSymbol');
      var savedView = localStorage.getItem('tnc.currentView');
      if (savedSymbol) state.currentSymbol = savedSymbol;
      if (savedView) state.currentView = savedView;
    } catch (e) { /* ignore storage errors */ }
  }

  function setConnectionState(nextState, message) {
    state.streamState = nextState;
    var indicator = document.getElementById('connectionIndicator');
    if (!indicator) return;
    indicator.classList.remove('live', 'connecting', 'offline');
    indicator.classList.add(nextState);
    if (nextState === 'live') indicator.textContent = 'Live';
    else if (nextState === 'offline') indicator.textContent = 'Offline';
    else indicator.textContent = 'Connecting...';
    if (message) indicator.title = message;
  }

  function scheduleReconnect() {
    if (state.reconnectTimer) return;
    state.reconnectAttempts += 1;
    var delay = Math.min(3000 + (state.reconnectAttempts * 1000), 12000);
    state.reconnectTimer = setTimeout(function() {
      state.reconnectTimer = null;
      connectSSE();
    }, delay);
  }

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
    persistState();
    loadDashboard();
    connectSSE();
  }

  function switchView(view) {
    state.currentView = view;
    persistState();
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
    setConnectionState('connecting', 'Connecting to live updates...');
    state.eventSource = new EventSource('/api/events?symbol=' + encodeURIComponent(state.currentSymbol));
    state.eventSource.onopen = function() {
      state.reconnectAttempts = 0;
      setConnectionState('live', 'Live updates connected');
    };
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
    state.eventSource.onerror = function() {
      setConnectionState('offline', 'Live updates disconnected. Reconnecting...');
      if (state.eventSource) state.eventSource.close();
      scheduleReconnect();
    };
  }

  function bindShortcuts() {
    document.addEventListener('keydown', function(e) {
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      var typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);

      if (!typing && e.key === '/') {
        e.preventDefault();
        document.getElementById('instrumentSearch').focus();
        return;
      }

      if (!typing && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        loadDashboard(true);
        TNC.showToast('Refreshing...');
      }
    });
  }

  async function init() {
    restoreState();
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

    window.addEventListener('instruments-changed', function() {
      loadInstruments().catch(function() {});
    });

    bindShortcuts();

    await loadInstruments();
    if (!state.instruments.some(function(i) { return i.symbol === state.currentSymbol; })) {
      state.currentSymbol = 'LMT';
    }
    selectInstrument(state.currentSymbol || 'LMT');
    switchView(state.currentView || 'dashboard');

    try {
      if (!localStorage.getItem('tnc.shortcutTipShown')) {
        TNC.showToast('Tip: press / to search instruments, and R to refresh data.');
        localStorage.setItem('tnc.shortcutTipShown', '1');
      }
    } catch (e) { /* ignore storage errors */ }

    setInterval(function() { loadDashboard(); }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
