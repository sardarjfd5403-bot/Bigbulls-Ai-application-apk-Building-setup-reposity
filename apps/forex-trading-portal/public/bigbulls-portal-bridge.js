/* BIGBULLS production host bridge: local preview mutations are replaced by authenticated app actions. */
(function () {
  'use strict';
  function emit(action, payload) {
    window.parent.postMessage({ source: 'BIGBULLS_HTML_PORTAL', action: action, payload: payload || {} }, window.location.origin);
  }
  function currentAccountNumber() {
    var a = typeof getActiveAccount === 'function' ? getActiveAccount() : null;
    return a && a.id ? String(a.id).replace(/^#/, '') : '';
  }
  var gate = document.createElement('style'); gate.textContent = 'html.bb-sync-pending body{visibility:hidden}'; document.documentElement.classList.add('bb-sync-pending'); document.head.appendChild(gate);\n  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    var data = event.data || {};
    if (data.source !== 'BIGBULLS_NATIVE_HOST') return;
    if (data.type === 'STATE') {
      var s = data.state || {};
      appState.accounts = s.accounts || { real: [], demo: [] };
      appState.accountMode = s.accountMode || 'real';
      appState.selectedAccountId = s.selectedAccountId || { real: '', demo: '' };
      appState.runningTrades = s.runningTrades || [];
      appState.closedTrades = s.closedTrades || [];
      appState.instruments = (s.instruments && s.instruments.length) ? s.instruments.map(function (q) {
        var old = (appState.instruments || []).find(function (x) { return x.symbol === q.symbol; }) || {};
        return Object.assign({}, old, q, { name: old.name || q.symbol, category: old.category || 'Forex', spread: String(Math.round((q.ask-q.bid)*Math.pow(10,q.digits||5))) });
      }) : appState.instruments;
      appState.aiSignals = []; appState.aiEvents = []; appState.aiNews = []; appState.ibClients = [];\n      appState.perfData = s.perfData || appState.perfData;
      appState.perfCurvePoints = s.perfCurvePoints || [];
      appState.email = s.email || '';
      syncAccountHeaderAndCard();
      renderTradesLists();
      renderMarketWatch();
      renderPerformance();
      renderProfileTab();
      var email = document.getElementById('profile-email-txt');
      if (email) email.textContent = s.email || '—';\n      document.documentElement.classList.remove('bb-sync-pending');\n      var chart = document.getElementById('chart-view'); if (chart && !chart.classList.contains('hidden')) drawMainChart();
      var wallet = document.getElementById('funding-wallet-bal');
      if (wallet) wallet.textContent = 'Connected wallet';
    } else if (data.type === 'ACTION_ERROR') {
      showToast(data.message || 'Request failed');
    }
  });
  window.addEventListener('load', function () { emit('READY'); });
  window.placeChartOrder = function (side) {
    var inst = getInstrumentBySymbol(appState.selectedSymbol);
    emit('OPEN_ORDER', { side: side, symbol: appState.selectedSymbol, lots: appState.lotSize, mode: appState.orderMode, price: appState.pendingPrice });
    showToast('Submitting order to BIGBULLS server…');
  };
  window.saveTradeSlTp = function () {
    var id = appState.editingTradeId;
    emit('MODIFY_POSITION', { id: id, sl: parseFloat(document.getElementById('te-sl-input').value)||0, tp: parseFloat(document.getElementById('te-tp-input').value)||0 });
    closeTradeEditModal();
    showToast('Submitting SL / TP update…');
  };
  window.closeRunningTradeNow = function () {
    var id = appState.editingTradeId;
    emit('CLOSE_POSITION', { id: id });
    closeTradeEditModal();
    showToast('Submitting close request…');
  };
  window.selectAccountById = function (id) {
    emit('SWITCH_ACCOUNT', { accountNumber: String(id).replace(/^#/, '') });
    appState.selectedAccountId[appState.accountMode] = id;
  };
  window.setAccountMode = function (mode) {
    appState.accountMode = mode;
    var list = appState.accounts[mode] || [];
    if (list[0]) emit('SWITCH_ACCOUNT', { accountNumber: String(list[0].id).replace(/^#/, '') });
    syncAccountHeaderAndCard();
  };
  window.setChartAccountMode = function (mode) { window.setAccountMode(mode); };\n  window.selectChartAccountById = function (id) { window.selectAccountById(id); };
  window.refreshAccountData = function () { emit('REFRESH'); showToast('Refreshing live BIGBULLS account data…'); };
  window.openFundModal = function (mode) { emit('NAVIGATE', { path: mode === 'withdraw' ? '/withdraw' : '/deposit' }); };
  window.submitFundRequest = function () { emit('NAVIGATE', { path: appState.fundMode === 'withdraw' ? '/withdraw' : '/deposit' }); };
  window.executeInternalTransfer = function () { emit('NAVIGATE', { path: '/transfer' }); };
  window.openNewAccount = function () { emit('NAVIGATE', { path: '/legacy/accounts' }); };
  window.openFullSettingsOverlay = function () { emit('NAVIGATE', { path: '/profile' }); };
  window.openIbPortal = function () { emit('NAVIGATE', { path: '/partner' }); };
  window.openTicketPrecheck = function () { emit('NAVIGATE', { path: '/support' }); };
  window.openLiveChatAssistant = function () { emit('NAVIGATE', { path: '/support' }); };
  window.openWalletSheet = function () { emit('NAVIGATE', { path: '/wallet' }); };
  window.openReferralSheet = function () { emit('NAVIGATE', { path: '/partner' }); };
  window.openSubpage = function (name) {
    if (name === 'support_hub' || name === 'copy') emit('NAVIGATE', { path: '/support' });
    else showToast('This section is being connected to your BIGBULLS account.');
  };
  window.toggleAiAutoTrade = function () { showToast('AI auto-execution is disabled until server-side risk controls are connected.'); };
  window.executeAiSignal = function () { showToast('AI signal execution is not enabled in this build.'); };
  window.askBbAiPrompt = function () { showToast('Live BB AI analysis is not connected yet. No generated demo analysis is shown.'); };
  window.submitCustomAiPrompt = function () { showToast('Live BB AI analysis is not connected yet.'); };
  window.startSafeTickLoop = function () {
    if (appState.tickTimer) clearInterval(appState.tickTimer);
    appState.tickTimer = null;
  };
  emit('READY');
})();
