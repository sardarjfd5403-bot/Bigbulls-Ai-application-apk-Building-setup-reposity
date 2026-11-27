/* BIGBULLS production bridge: HTML portal actions are delegated to authenticated Supabase services. */
(function () {
  'use strict';
  var fundData = { methods: [], wallets: [], transactions: [], wallet: null };
  var fundTxnId = '';
  var htmlOpenTicketPrecheck = window.openTicketPrecheck;
  var htmlOpenSubpage = window.openSubpage;
  var htmlSwitchTab = window.switchTab;
  var htmlRenderBbAiTab = window.renderBbAiTab;

  function emit(action, payload) {
    window.parent.postMessage({ source: 'BIGBULLS_HTML_PORTAL', action: action, payload: payload || {} }, window.location.origin);
  }
  function toast(message) {
    if (typeof showToast === 'function') showToast(message);
  }
  function byId(id) { return document.getElementById(id); }
  function value(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
  function field(label, id, type, placeholder) {
    return '<label style="display:block;margin:0 0 10px;font-size:12px;font-weight:800;color:#344054;">' +
      escapeHtml(label) + '<input id="' + id + '" type="' + type + '" placeholder="' + escapeHtml(placeholder || '') +
      '" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;font-size:14px;" /></label>';
  }
  function selectField(label, id, options) {
    return '<label style="display:block;margin:0 0 10px;font-size:12px;font-weight:800;color:#344054;">' +
      escapeHtml(label) + '<select id="' + id + '" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;font-size:14px;">' +
      options + '</select></label>';
  }
  function openSheet(html) {
    if (typeof openProfileSheet === 'function') openProfileSheet(html);
  }
  function accountOptions() {
    return (appState.accounts.real || []).map(function (a) {
      return '<option value="' + escapeHtml(a.backendId) + '">' + escapeHtml(a.id + ' · ' + a.label + ' · ' + a.type) + '</option>';
    }).join('');
  }

  var gate = document.createElement('style');
  gate.textContent = 'html.bb-sync-pending body{visibility:hidden}';
  document.documentElement.classList.add('bb-sync-pending');
  document.head.appendChild(gate);

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    var data = event.data || {};
    if (data.source !== 'BIGBULLS_NATIVE_HOST') return;

    if (data.type === 'STATE') {
      var s = data.state || {};
      appState.accounts = s.accounts || { real: [], demo: [] };
      appState.accountMode = s.accountMode || 'real';
      appState.selectedAccountId = s.selectedAccountId || { real: '', demo: '' };
      appState.runningTrades = s.runningTrades || [];
      appState.pendingOrders = s.pendingOrders || [];
      appState.closedTrades = s.closedTrades || [];
      if (s.instruments && s.instruments.length) {
        appState.instruments = s.instruments.map(function (q) {
          var old = (appState.instruments || []).find(function (x) { return x.symbol === q.symbol; }) || {};
          return Object.assign({}, old, q, {
            name: old.name || q.symbol,
            category: old.category || 'Forex',
            spread: String(Math.round((q.ask - q.bid) * Math.pow(10, q.digits || 5)))
          });
        });
      }
      appState.aiSignals = [];
      appState.aiEvents = [];
      appState.aiNews = [];
      appState.ibClients = [];
      if (typeof renderBbAiTab === 'function') renderBbAiTab();
      ensureAiScanButton();
      appState.perfData = s.perfData || appState.perfData;
      appState.perfDataByFilter = s.perfDataByFilter || appState.perfDataByFilter;
      appState.perfCurvePoints = s.perfCurvePoints || [];
      appState.email = s.email || '';
      syncAccountHeaderAndCard();
      renderTradesLists();
      renderPendingOrders();
      renderMarketWatch();
      renderPerformance();
      renderProfileTab();
      document.querySelectorAll('.profile-row').forEach(function (row) {
        if ((row.textContent || '').toLowerCase().includes('verification progress')) {
          row.onclick = function () { window.openKycSheet(); };
        }
      });
      var email = byId('profile-email-txt');
      if (email) email.textContent = s.email || '—';
      document.documentElement.classList.remove('bb-sync-pending');
      var chart = byId('chart-view');
      if (chart && !chart.classList.contains('hidden')) window.generateChartCandles();
      var walletLabel = byId('funding-wallet-bal');
      if (walletLabel && fundData.wallet) {
        var wb = fundData.wallet;
        var amount = Number(wb.balance != null ? wb.balance : (wb.available_balance != null ? wb.available_balance : 0));
        walletLabel.textContent = Number.isFinite(amount) ? '$' + amount.toFixed(2) : 'Wallet connected';
      }
    } else if (data.type === 'BB_AI_SIGNALS') {
      appState.aiSignals=data.signals||[];
      if(typeof renderBbAiTab==='function')renderBbAiTab();
      toast(appState.aiSignals.length?appState.aiSignals.length+' live technical setup(s) found.':'No qualifying technical setups right now.');
    } else if (data.type === 'BB_AI_RESULT') {
      var r=data.report||{};
      pushAiMessage('BB AI','Live technical snapshot for '+r.symbol+' ('+r.timeframe+'): '+r.bias+'. Price '+r.price+', EMA 9 '+r.ema9+', EMA 21 '+r.ema21+', RSI(14) '+r.rsi+'. Recent support '+r.support+' and resistance '+r.resistance+'. Based on '+r.candles+' historical candles; this is technical analysis, not a guaranteed trade signal.');
    } else if (data.type === 'CANDLES') {
      if (data.symbol === appState.selectedSymbol && data.timeframe === (appState.timeframe || '1m')) {
        appState.candles = (data.candles || []).map(function (c) {
          return { open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c), time: c.t };
        });
        if (appState.candles.length) drawMainChart();
        else toast('No historical candles returned for this instrument/timeframe.');
      }
    } else if (data.type === 'FUND_DATA') {
      fundData = data.data || fundData;
      renderFundData();
      var walletLabel2 = byId('funding-wallet-bal');
      if (walletLabel2 && fundData.wallet) {
        var wb2 = fundData.wallet;
        var amount2 = Number(wb2.balance != null ? wb2.balance : (wb2.available_balance != null ? wb2.available_balance : 0));
        walletLabel2.textContent = Number.isFinite(amount2) ? '$' + amount2.toFixed(2) : 'Wallet connected';
      }
    } else if (data.type === 'FUND_RESULT') {
      if (data.ok) {
        toast(data.message || 'Payment request updated.');
        if (data.otpRequired) {
          fundTxnId = data.transactionId || '';
          var otpBox = byId('bb-fund-otp-box');
          if (otpBox) otpBox.style.display = 'block';
        } else if (appState.fundMode === 'deposit' || data.otpVerified) {
          closeFundModal();
        }
      } else toast(data.message || 'Payment request failed.');
    } else if (data.type === 'APP_LOCK_DATA') {
      window.bbAppLockEnabled=!!data.enabled;ensureAppLockRow(data);
    } else if (data.type === 'BIOMETRIC_DATA') {
      appState.settings.biometrics=!!data.enabled;
      var bioRow=Array.from(document.querySelectorAll('.profile-row')).find(function(x){return (x.textContent||'').toLowerCase().includes('sign-in with biometrics');});
      var bioTrack=bioRow&&bioRow.querySelector('.sw-track');if(bioTrack)bioTrack.classList.toggle('on',!!data.enabled);
      if(bioRow&&!data.available){bioRow.title='No enrolled biometric method detected on this device.';}
    } else if (data.type === 'BIOMETRIC_RESULT') {
      appState.settings.biometrics=!!data.enabled;
      var bioRow2=Array.from(document.querySelectorAll('.profile-row')).find(function(x){return (x.textContent||'').toLowerCase().includes('sign-in with biometrics');});
      var bioTrack2=bioRow2&&bioRow2.querySelector('.sw-track');if(bioTrack2)bioTrack2.classList.toggle('on',!!data.enabled);
      toast(data.message||'Biometric preference updated.');
    } else if (data.type === 'APP_LOCK_RESULT') {
      toast(data.message||'App Lock updated.');closeProfileSheet();emit('APP_LOCK_INIT');
    } else if (data.type === 'NOTIFICATIONS_RESULT') {
      appState.settings.notifications=!!data.enabled;
      var row=Array.from(document.querySelectorAll('.profile-row')).find(function(x){return (x.textContent||'').toLowerCase().includes('notifications');});
      var track=row&&row.querySelector('.sw-track');if(track)track.classList.toggle('on',!!data.enabled);
      toast(data.message||'Notification preference updated.');
    } else if (data.type === 'KYC_DATA') {
      var record = data.record || null;
      var status = byId('bb-kyc-status');
      if (status) {
        status.textContent = record ? 'Current status: ' + String(record.status || 'pending').toUpperCase() : 'No verification submitted yet.';
        if (record && record.admin_note) status.textContent += ' · ' + record.admin_note;
        if (record && record.rejection_reasons && record.rejection_reasons.length) status.textContent += ' · ' + record.rejection_reasons.join(', ');
      }
      if (record && ['approved', 'verified', 'pending'].includes(String(record.status).toLowerCase())) {
        var form = byId('bb-kyc-form');
        if (form) form.style.display = 'none';
      }
      document.querySelectorAll('.profile-row').forEach(function (row) {
        if ((row.textContent || '').toLowerCase().includes('verification progress')) {
          var badge = row.querySelector('.label-circle-badge');
          if (badge) badge.textContent = record ? String(record.status || 'pending').replace(/_/g, ' ').toUpperCase() : 'Verify now';
        }
      });
    } else if (data.type === 'KYC_RESULT') {
      toast(data.message || 'Verification submitted.');
      var kycStatus = byId('bb-kyc-status');
      if (kycStatus) kycStatus.textContent = 'Current status: PENDING REVIEW';
      var kycForm = byId('bb-kyc-form');
      if (kycForm) kycForm.style.display = 'none';
    } else if (data.type === 'WALLET_DATA') {
      var balanceBox = byId('bb-wallet-summary');
      var ledgerBox = byId('bb-wallet-ledger');
      var raw = data.data && data.data.balance != null ? data.data.balance :
        (data.data && data.data.available_balance != null ? data.data.available_balance : 0);
      if (balanceBox) balanceBox.innerHTML = '<b>Available wallet balance</b><div style="font-size:26px;font-weight:900;margin-top:8px;">$' + Number(raw || 0).toFixed(2) + '</div>';
      if (ledgerBox) {
        var ledger = data.data && data.data.ledger || [];
        ledgerBox.innerHTML = '<b>Recent wallet activity</b>' + (ledger.slice(0, 12).map(function (x) {
          return '<div style="padding:7px 0;border-bottom:1px solid #e5eaf2;">' + escapeHtml(x.entry_type || 'Wallet') + ' · ' +
            escapeHtml(x.direction || '') + ' $' + Number(x.amount || 0).toFixed(2) + ' · ' +
            escapeHtml(new Date(x.created_at).toLocaleDateString()) + '</div>';
        }).join('') || '<div style="padding:8px 0;">No wallet activity.</div>');
      }
    } else if (data.type === 'PARTNER_DATA') {
      window.bbPartnerData=data.data||{};
      window.renderIbContent();
    } else if (data.type === 'SUPPORT_DATA') {
      var supportBox = byId('bb-support-history');
      if (supportBox) supportBox.innerHTML = '<b>Your recent tickets</b>' + ((data.tickets || []).slice(0, 8).map(function (t) {
        return '<div style="padding:7px 0;border-bottom:1px solid #e5eaf2;">' + escapeHtml(t.subject) + ' · <b>' +
          escapeHtml(String(t.status || '').toUpperCase()) + '</b><br><span style="font-size:11px;">' +
          escapeHtml(t.admin_reply || t.message || '') + '</span></div>';
      }).join('') || '<div>No support tickets yet.</div>');
    } else if (data.type === 'MFA_DATA') {
      var enabled=!!data.enabled, factors=data.factors||[];
      window.bbMfaFactorId=enabled&&factors[0]?factors[0].id:'';
      openSheet('<div class="card-title-row"><div class="card-title">Two-factor authentication</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub" style="margin:10px 0 14px;">'+(enabled?'Authenticator protection is enabled.':'Protect your BIGBULLS sign-in with an authenticator app.')+'</div>'+(enabled?'<button class="primary-btn" style="width:100%;" onclick="disableHtmlMfa()">Disable 2FA</button>':'<button class="primary-btn" style="width:100%;" onclick="emitMfaEnroll()">Set up authenticator</button>'));
    } else if (data.type === 'MFA_ENROLL_DATA') {
      window.bbMfaFactorId=data.factorId;
      openSheet('<div class="card-title-row"><div class="card-title">Set up authenticator</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub">Scan this QR code in your authenticator app, then enter the 6-digit code.</div><img alt="Authenticator QR code" src="'+escapeHtml(data.qrCode)+'" style="display:block;width:210px;height:210px;margin:14px auto;"><div style="font-size:11px;word-break:break-all;margin-bottom:12px;">Manual setup key: '+escapeHtml(data.secret)+'</div>'+field('6-digit verification code','bb-mfa-code','text','000000')+'<button class="primary-btn" style="width:100%;" onclick="verifyHtmlMfa()">Verify and enable 2FA</button>');
    } else if (data.type === 'PROFILE_DATA') {
      var profile = data.data || {};
      if (byId('bb-profile-name')) byId('bb-profile-name').value = profile.full_name || '';
      var nameNode=document.querySelector('.bronze-card div[style*="font-size:15px"]');if(nameNode)nameNode.textContent=profile.full_name||'BIGBULLS Client';
      var bronze=document.querySelector('.bronze-card');if(bronze){var spans=bronze.querySelectorAll('span');if(spans[1])spans[1].textContent='Client account';var coin=bronze.querySelector('.tab-num');if(coin)coin.textContent='';}
      ensureProfileDetailsRow();
      var benefits=Array.from(document.querySelectorAll('.card')).find(function(card){var label=card.querySelector('.profile-sec-label');return label&&(label.textContent||'').trim()==='Benefits';});if(benefits)benefits.style.display='none';
      if (byId('bb-profile-country')) byId('bb-profile-country').value = profile.country || '';
      if (byId('bb-profile-phone')) byId('bb-profile-phone').value = profile.phone || '';
      if (byId('bb-profile-email')) byId('bb-profile-email').textContent = profile.email || appState.email || '';
    } else if (data.type === 'WORKFLOW_RESULT') {
      if (data.ok) {
        toast(data.message || 'Saved successfully.');
        if (data.workflow === 'transfer') { window.refreshAccountData(); closeProfileSheet(); }
        if (data.workflow === 'account') closeProfileSheet();
        if (data.workflow === 'password') { var passInput=byId('new-pass-inp'); if(passInput)passInput.value=''; }
        if (data.workflow === 'support') { var sub=byId('subpage-view'); if(sub)sub.classList.add('hidden'); emit('SUPPORT_INIT'); }
        if (data.workflow === 'profile') emit('PROFILE_INIT');
        if (data.workflow === 'partner' || data.workflow === 'partner_transfer') { emit('PARTNER_INIT'); }
      } else toast(data.message || 'Request failed.');
    } else if (data.type === 'ACTION_ERROR') {
      toast(data.message || 'Request failed');
    }
  });

  var lastCandleKey = '';
  var lastCandleAt = 0;
  window.selectPerfAccountFilter = function (key) {
    appState.perfAccountFilter = key;
    var modal = byId('perf-acc-modal'); if (modal) modal.classList.add('hidden');
    window.renderPerformance();
    if (typeof drawPerformanceCharts === 'function') drawPerformanceCharts();
  };
  window.renderPerformance = function () {
    var filters = appState.perfDataByFilter || {};
    var selected = filters[appState.perfAccountFilter || 'all'];
    var period = appState.perfPeriod || '30D';
    var stats = selected && (selected[period] || selected['30D']);
    if (!stats) return;
    var names = {all:'All accounts',real:'Real accounts',demo:'Demo accounts'};
    setText('perf-acc-selected-label', names[appState.perfAccountFilter || 'all']);
    setText('perf-net-profit', (stats.net >= 0 ? '+' : '-') + fmtMoney(Math.abs(stats.net)));
    setText('perf-profit-factor', Number(stats.pf || 0).toFixed(2));
    setText('perf-win-rate', Number(stats.win || 0).toFixed(1) + '%');
    var bar = byId('perf-win-bar'); if (bar) bar.style.width = Math.max(0,Math.min(100,Number(stats.win)||0)) + '%';
    setText('kpi-closed', String(stats.closed || 0));
    setText('kpi-volume', stats.vol || '0.00 Lots');
    setText('kpi-tprofit', '+' + fmtMoney(Number(stats.profit)||0));
    setText('kpi-tloss', '-' + fmtMoney(Number(stats.loss)||0));
    setText('kpi-best', '+' + fmtMoney(Number(stats.best)||0));
    setText('kpi-avg', (Number(stats.avg)>=0?'+':'-') + fmtMoney(Math.abs(Number(stats.avg)||0)));
  };
    function renderPendingOrders() {
    var run = byId('running-trades-list');
    if (!run) return;
    var box = byId('bb-pending-orders');
    if (!box) {
      box = document.createElement('div'); box.id = 'bb-pending-orders';
      box.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #e5eaf2;';
      run.parentNode.insertBefore(box, run.nextSibling);
    }
    var rows = appState.pendingOrders || [];
    box.innerHTML = '<div style="font-size:12px;font-weight:900;margin-bottom:7px;">Pending orders ('+rows.length+')</div>' +
      (rows.map(function(p){return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #edf1f6;">'+
        '<div><b>'+escapeHtml(p.side+' '+p.kind+' '+p.symbol)+'</b><div style="font-size:11px;color:#64748b;">'+Number(p.lots).toFixed(2)+' lots · '+Number(p.price).toFixed(5)+' · SL '+Number(p.sl||0)+' · TP '+Number(p.tp||0)+'</div></div>'+
        '<button type="button" class="secondary-btn" onclick="cancelHtmlPending(\''+escapeHtml(p.id)+'\')">Cancel</button></div>';}).join('') || '<div style="font-size:12px;color:#64748b;">No pending orders</div>');
  }
  window.cancelHtmlPending = function(id) { emit('CANCEL_PENDING',{id:id}); toast('Cancel request submitted…'); };
    window.switchTab = function(tabName){
    if(typeof htmlSwitchTab==='function')htmlSwitchTab(tabName);
    if(tabName==='profile'){emit('PROFILE_INIT');emit('KYC_INIT');}
    if(tabName==='trade'&&appState.selectedSymbol)window.generateChartCandles();
  };
  function ensureProfileDetailsRow(){
    var cards=Array.from(document.querySelectorAll('.card'));
    var accountCard=cards.find(function(card){var label=card.querySelector('.profile-sec-label');return label&&(label.textContent||'').trim()==='Account';});
    if(!accountCard||byId('bb-profile-details-row'))return;
    var row=document.createElement('div');row.id='bb-profile-details-row';row.className='profile-row';
    row.innerHTML='<div style="font-size:13px;font-weight:800;">Personal details</div><span class="label-circle-badge">Edit &rsaquo;</span>';
    row.onclick=function(){window.openProfileEditSheet();};
    accountCard.appendChild(row);
  }
  window.openProfileEditSheet=function(){
    openSheet('<div class="card-title-row"><div class="card-title">Personal details</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div id="bb-profile-email" class="card-sub" style="margin:8px 0;">Loading profile…</div>'+field('Full name','bb-profile-name','text','Full legal name')+field('Country','bb-profile-country','text','Country')+field('Phone','bb-profile-phone','tel','+92')+'<button class="primary-btn" style="width:100%;" onclick="saveHtmlProfile()">Save profile</button>');
    emit('PROFILE_INIT');
  };
    window.renderProfileTab = function () {
    var email=String(appState.email||'');
    var shown=email;
    if(appState.emailMasked&&email.indexOf('@')>0){var parts=email.split('@');shown=(parts[0].slice(0,1)+'***@'+parts[1]);}
    setText('profile-email-txt',shown||'—');
    setText('profile-eye-label',appState.emailMasked?'Show':'Hide');
  };
    window.generateChartCandles = function () {
    var symbol = appState.selectedSymbol, timeframe = appState.timeframe || '1m';
    var key = symbol + '|' + timeframe, now = Date.now();
    if (key === lastCandleKey && now - lastCandleAt < 30000) return;
    lastCandleKey = key; lastCandleAt = now;
    emit('GET_CANDLES', { symbol: symbol, timeframe: timeframe });
  };
  window.placeChartOrder = function (side) {
    if(appState.orderMode!=='MARKET'&&appState.accountMode==='demo'){toast('Pending orders are currently supported on Real accounts only.');return;}
    emit('OPEN_ORDER', { side: side, symbol: appState.selectedSymbol, lots: appState.lotSize, mode: appState.orderMode, price: appState.pendingPrice });
    toast('Submitting order to BIGBULLS server…');
  };
  window.saveTradeSlTp = function () {
    emit('MODIFY_POSITION', { id: appState.editingTradeId, sl: parseFloat(value('te-sl-input')) || 0, tp: parseFloat(value('te-tp-input')) || 0 });
    closeTradeEditModal();
    toast('Submitting SL / TP update…');
  };
  window.closeRunningTradeNow = function () {
    emit('CLOSE_POSITION', { id: appState.editingTradeId });
    closeTradeEditModal();
    toast('Submitting close request…');
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
  window.setChartAccountMode = function (mode) { window.setAccountMode(mode); };
  window.selectChartAccountById = function (id) { window.selectAccountById(id); };
  window.refreshAccountData = function () { emit('REFRESH'); toast('Refreshing live BIGBULLS account data…'); };

  function fundInput(label, id, type, placeholder) {
    var wrap = document.createElement('label');
    wrap.style.cssText = 'display:block;margin:0 0 10px;font-size:12px;font-weight:800;color:#344054;';
    wrap.textContent = label;
    var input = document.createElement('input');
    input.id = id; input.type = type; input.placeholder = placeholder || '';
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;font-size:14px;';
    if (type === 'file') { input.accept = 'image/png,image/jpeg,image/webp,application/pdf'; input.style.minHeight='44px'; }
    wrap.appendChild(input);
    return wrap;
  }
  function ensureFundFields() {
    var panel = document.querySelector('#fund-modal .sheet-panel');
    if (!panel) return null;
    var existing = byId('bb-live-fund-fields');
    if (existing) return existing;
    var box = document.createElement('div');
    box.id = 'bb-live-fund-fields';
    box.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #e5eaf2;border-radius:16px;background:#f8faff;';
    var grid = byId('payment-methods-grid');
    if (grid) grid.style.display = 'none';
    var oldAmount = byId('fund-amount-input');
    if (oldAmount && oldAmount.parentElement) oldAmount.parentElement.style.display = 'none';
    var method = document.createElement('select'); method.id = 'bb-fund-method';
    method.style.cssText = 'display:block;width:100%;margin:0 0 10px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;';
    var methodLabel = document.createElement('label'); methodLabel.textContent = 'Payment method / network'; methodLabel.style.cssText = 'display:block;margin-bottom:10px;font-size:12px;font-weight:800;color:#344054;';
    methodLabel.appendChild(method); box.appendChild(methodLabel);
    var details = document.createElement('div'); details.id = 'bb-fund-method-details'; details.style.cssText = 'font-size:12px;color:#475467;line-height:1.5;margin:0 0 12px;'; box.appendChild(details);
    var accounts = document.createElement('select'); accounts.id = 'bb-fund-account';
    accounts.style.cssText = method.style.cssText;
    var accountLabel = document.createElement('label'); accountLabel.textContent = 'Real trading account'; accountLabel.style.cssText = methodLabel.style.cssText;
    accountLabel.appendChild(accounts); box.appendChild(accountLabel);
    box.appendChild(fundInput('Amount (USD)', 'bb-fund-usd', 'number', '0.00'));
    box.appendChild(fundInput('Amount in payment currency', 'bb-fund-crypto', 'number', '0.00'));
    box.appendChild(fundInput('Blockchain TXID (crypto deposit)', 'bb-fund-txid', 'text', 'Transaction hash'));
    box.appendChild(fundInput('Withdrawal destination address', 'bb-fund-destination', 'text', 'Wallet address'));
    box.appendChild(fundInput('Payment proof (bank / fiat transfer)', 'bb-fund-proof', 'file', ''));
    var submit = byId('fund-submit-btn');
    panel.insertBefore(box, submit);
    var otpBox = document.createElement('div'); otpBox.id = 'bb-fund-otp-box'; otpBox.style.cssText = 'display:none;margin-top:12px;';
    otpBox.appendChild(fundInput('Email OTP', 'bb-fund-otp', 'text', '6-digit code'));
    var verify = document.createElement('button'); verify.type = 'button'; verify.textContent = 'Verify withdrawal OTP'; verify.className = 'primary-btn';
    verify.onclick = function () { emit('FUND_VERIFY_OTP', { transactionId: fundTxnId, otp: value('bb-fund-otp') }); };
    otpBox.appendChild(verify);
    var resend = document.createElement('button'); resend.type = 'button'; resend.textContent = 'Resend OTP'; resend.className = 'secondary-btn'; resend.style.marginTop = '8px';
    resend.onclick = function () { emit('FUND_RESEND_OTP', { transactionId: fundTxnId }); };
    otpBox.appendChild(resend);
    panel.insertBefore(otpBox, submit);
    var history = document.createElement('div'); history.id = 'bb-fund-history';
    history.style.cssText = 'margin-top:14px;border-top:1px solid #e5eaf2;padding-top:10px;font-size:12px;color:#475467;';
    box.appendChild(history);
    method.onchange = renderFundData;
    return box;
  }
  function renderFundData() {
    if (!ensureFundFields()) return;
    var mode = appState.fundMode === 'withdraw' ? 'withdraw' : 'deposit';
    var methods = mode === 'withdraw' ? fundData.wallets : fundData.methods;
    var method = byId('bb-fund-method');
    var previous = method.value;
    method.innerHTML = '';
    methods.forEach(function (m) {
      var option = document.createElement('option'); option.value = m.id;
      option.textContent = mode === 'withdraw' ? (m.asset + ' · ' + m.network + (m.label ? ' · ' + m.label : '')) : (m.display_name + ' · ' + m.network);
      method.appendChild(option);
    });
    if (methods.some(function (m) { return m.id === previous; })) method.value = previous;
    var selected = methods.find(function (m) { return m.id === method.value; });
    var details = byId('bb-fund-method-details');
    if (details) {
      if (!selected) details.textContent = 'No active payment method is configured.';
      else if (mode === 'withdraw') details.textContent = 'Withdrawal network: ' + selected.asset + ' · ' + selected.network;
      else {
        details.innerHTML = '<b>' + escapeHtml(selected.display_name || 'Payment method') + '</b><br>' +
          escapeHtml(selected.instructions || '') + '<br><b>Payment destination:</b> ' +
          escapeHtml((selected.method_type==='crypto' ? ((fundData.wallets||[]).find(function(w){return w.id===selected.crypto_wallet_id;})||{}).address : '') || selected.destination_details || selected.account_number || 'Follow the payment instructions.') +
          (selected.account_title ? '<br>Account title: ' + escapeHtml(selected.account_title) : '') +
          (selected.logo_url ? '<br><img src="' + escapeHtml(selected.logo_url) + '" alt="Payment method" style="max-width:140px;max-height:140px;margin-top:8px;border-radius:8px;">' : '');
      }
    }
    var accounts = byId('bb-fund-account');
    accounts.innerHTML = '';
    (appState.accounts.real || []).forEach(function (a) {
      var option = document.createElement('option'); option.value = a.backendId;
      option.textContent = a.id + ' · ' + a.label + ' · ' + Number(a.balance || 0).toFixed(2) + ' USD';
      accounts.appendChild(option);
    });
    var withdraw = mode === 'withdraw';
    var txid = byId('bb-fund-txid'), proof = byId('bb-fund-proof'), destination = byId('bb-fund-destination');
    if (txid) txid.parentElement.style.display = (!withdraw && selected && selected.method_type === 'crypto') ? 'block' : 'none';
    if (proof) proof.parentElement.style.display = (!withdraw && selected && selected.method_type !== 'crypto') ? 'block' : 'none';
    if (destination) destination.parentElement.style.display = withdraw ? 'block' : 'none';
    var submit = byId('fund-submit-btn');
    if (submit) submit.textContent = withdraw ? 'Submit Withdrawal Request' : 'Submit Deposit Request';
    var history = byId('bb-fund-history');
    if (history) history.innerHTML = '<b>Recent payment requests</b>' + (fundData.transactions || []).slice(0, 5).map(function (t) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #eef1f5;"><span>' +
        escapeHtml(String(t.kind || '').toUpperCase()) + ' · $' + Number(t.amount_usd || 0).toFixed(2) + '</span><b>' +
        escapeHtml(String(t.status || 'pending').toUpperCase()) + '</b></div>';
    }).join('') || '<div style="padding:8px 0;">No payment requests yet.</div>';
  }
  window.openFundModal = function (mode) {
    appState.fundMode = mode === 'withdraw' ? 'withdraw' : 'deposit';
    setText('fund-modal-title', mode === 'withdraw' ? 'Withdraw Funds' : 'Deposit Funds');
    var modal = byId('fund-modal'); if (modal) modal.classList.remove('hidden');
    ensureFundFields(); renderFundData(); emit('FUND_INIT');
  };
  window.submitFundRequest = function () {
    var methodId = value('bb-fund-method');
    var methods = appState.fundMode === 'withdraw' ? fundData.wallets : fundData.methods;
    var method = methods.find(function (m) { return m.id === methodId; });
    if (!method) { toast('No active payment method is available.'); return; }
    var proof = byId('bb-fund-proof');
    emit('FUND_SUBMIT', {
      mode: appState.fundMode, methodId: methodId, accountId: value('bb-fund-account'),
      amountUsd: value('bb-fund-usd'), amountCrypto: value('bb-fund-crypto'),
      asset: method.asset, network: method.network, txHash: value('bb-fund-txid'),
      destination: value('bb-fund-destination'), proof: proof && proof.files ? (proof.files[0] || null) : null
    });
    toast('Submitting secure payment request…');
  };

  window.openKycSheet = function () {
    openSheet('<div class="card-title-row"><div class="card-title">Identity verification</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div id="bb-kyc-status" class="card-sub" style="margin:8px 0 14px;">Loading verification status…</div><div id="bb-kyc-form">' +
      '<div style="font-size:13px;font-weight:900;margin-bottom:10px;">Personal details</div>' +
      field('Full legal name', 'bb-kyc-name', 'text', 'As shown on document') +
      field('First name', 'bb-kyc-first', 'text', 'First name') + field('Last name', 'bb-kyc-last', 'text', 'Last name') +
      field('Date of birth', 'bb-kyc-dob', 'date', '') + field('Country', 'bb-kyc-country', 'text', 'Country') +
      field('Residential address', 'bb-kyc-address', 'text', 'Full address') +
      selectField('Document type', 'bb-kyc-type', '<option value="CNIC">CNIC</option><option value="Passport">Passport</option><option value="Driving License">Driving License</option>') +
      field('Document number', 'bb-kyc-number', 'text', 'Document number') +
      field('Front side (100 KB–20 MB)', 'bb-kyc-front', 'file', '') +
      field('Back side (100 KB–20 MB)', 'bb-kyc-back', 'file', '') +
      '<button class="primary-btn" style="width:100%;margin-top:8px;" onclick="submitKycFromHtml()">Submit verification</button></div>');
    emit('KYC_INIT');
  };
  window.submitKycFromHtml = function () {
    var front = byId('bb-kyc-front'), back = byId('bb-kyc-back');
    emit('KYC_SUBMIT', {
      values: {
        legal_name: value('bb-kyc-name'), first_name: value('bb-kyc-first'), last_name: value('bb-kyc-last'),
        date_of_birth: value('bb-kyc-dob'), country: value('bb-kyc-country'),
        residential_address: value('bb-kyc-address'), document_type: value('bb-kyc-type'),
        document_number: value('bb-kyc-number')
      },
      front: front && front.files ? (front.files[0] || null) : null,
      back: back && back.files ? (back.files[0] || null) : null
    });
    toast('Submitting identity verification…');
  };

  window.openNewAccount = function () {
    openSheet('<div class="card-title-row"><div class="card-title">Open trading account</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div class="card-sub" style="margin:8px 0 14px;">Create a BIGBULLS account using the secure account service.</div>' +
      selectField('Account mode', 'bb-new-mode', '<option value="real">Real account</option><option value="demo">Demo account</option>') +
      selectField('Account type', 'bb-new-kind', '<option value="Standard">Standard</option><option value="Raw Spread">Raw Spread</option><option value="Pro">Pro</option>') +
      selectField('Leverage', 'bb-new-leverage', '<option value="100">1:100</option><option value="200">1:200</option><option value="500">1:500</option><option value="1000">1:1000</option>') +
      '<button class="primary-btn" style="width:100%;" onclick="submitNewAccount()">Create account</button>');
  };
  window.submitNewAccount = function () {
    emit('OPEN_ACCOUNT', { type: value('bb-new-mode'), kind: value('bb-new-kind'), leverage: value('bb-new-leverage') });
    toast('Creating trading account…');
  };

  window.executeInternalTransfer = function () {
    openSheet('<div class="card-title-row"><div class="card-title">Funds transfer</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div class="card-sub" style="margin:6px 0 14px;">Transfer between your BIGBULLS wallet and trading accounts.</div>' +
      selectField('From', 'bb-transfer-from', '<option value="wallet">BIGBULLS Wallet</option>' + accountOptions()) +
      selectField('To', 'bb-transfer-to', accountOptions() + '<option value="wallet">BIGBULLS Wallet</option>') +
      field('Amount (USD)', 'bb-transfer-amount', 'number', '0.00') + field('Note (optional)', 'bb-transfer-note', 'text', 'Transfer note') +
      '<button class="primary-btn" style="width:100%;" onclick="submitHtmlTransfer()">Confirm transfer</button>');
  };
  window.submitHtmlTransfer = function () {
    var from = value('bb-transfer-from'), to = value('bb-transfer-to');
    if (from === to) { toast('Choose different source and destination.'); return; }
    emit('TRANSFER_SUBMIT', {
      fromType: from === 'wallet' ? 'wallet' : 'account', fromAccountId: from === 'wallet' ? '' : from,
      toType: to === 'wallet' ? 'wallet' : 'account', toAccountId: to === 'wallet' ? '' : to,
      amount: value('bb-transfer-amount'), note: value('bb-transfer-note')
    });
    toast('Submitting secure transfer…');
  };

  window.openWalletSheet = function () {
    openSheet('<div class="card-title-row"><div class="card-title">BIGBULLS Wallet</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div id="bb-wallet-summary" class="card" style="margin:12px 0;">Loading live wallet…</div><div id="bb-wallet-ledger" class="card-sub">Loading wallet history…</div>');
    emit('WALLET_INIT');
  };
  window.openIbPortal = function () {
    closeProfileSheet();
    var view=byId('ib-portal-view'); if(view)view.classList.remove('hidden');
    appState.ibSection='dashboard';
    window.renderIbContent();
    emit('PARTNER_INIT');
  };
  window.renderIbContent = function () {
    var body=byId('ib-content-body'); if(!body)return;
    var d=window.bbPartnerData||{}, a=d.application||null, w=d.wallet||{};
    var section=appState.ibSection||'dashboard';
    var money=function(n){return '$'+Number(n||0).toFixed(2);};
    var rows='';
    if(section==='rep_clients'){
      rows=(d.referrals||[]).map(function(x){return '<div class="trade-item" style="cursor:default;"><div><b>Client '+escapeHtml(String(x.referred_user_id||'').slice(-7)||'—')+'</b><div class="card-sub">'+escapeHtml(new Date(x.created_at).toLocaleDateString())+'</div></div><span class="label-circle-badge">Referral</span></div>';}).join('')||'<div class="card-sub">No referrals recorded yet.</div>';
      body.innerHTML='<div class="card"><div class="card-title">Referred clients</div>'+rows+'</div>';return;
    }
    if(section==='rep_tx'||section==='rebates'){
      var tx=section==='rebates'?(d.commissions||[]):(d.ledger||[]).concat(d.depositCommissions||[]);
      rows=tx.map(function(x){var amount=x.commission_usd??x.commission_amount_usd??x.amount??0;return '<div class="trade-item" style="cursor:default;"><div><b>'+escapeHtml(x.entry_type||x.symbol||'Commission')+'</b><div class="card-sub">'+escapeHtml(String(x.status||x.direction||'recorded').toUpperCase())+' · '+escapeHtml(new Date(x.created_at).toLocaleDateString())+'</div></div><span class="tab-num" style="font-weight:900;">'+money(amount)+'</span></div>';}).join('')||'<div class="card-sub">No partner transactions recorded yet.</div>';
      body.innerHTML='<div class="card"><div class="card-title">'+(section==='rebates'?'Rebates and commissions':'Partner wallet transactions')+'</div>'+rows+'</div>';return;
    }
    if(!a){
      body.innerHTML='<div class="card"><div class="card-title">Become a BIGBULLS Partner</div><div class="card-sub" style="margin:8px 0 14px;">Submit your partner application for review. Your referral account is activated after approval.</div>'+
        field('Business name','bb-partner-name','text','Business name')+field('Website or social link','bb-partner-link','text','https://')+field('Audience size','bb-partner-audience','text','e.g. 5000')+field('Experience','bb-partner-experience','text','Forex / IB experience')+
        '<button class="primary-btn" style="width:100%;" onclick="submitPartnerApplication()">Apply as partner</button></div>';return;
    }
    var accounts=appState.accounts.real||[];
    var accountOpts=accounts.map(function(x){return '<option value="'+escapeHtml(x.backendId)+'">'+escapeHtml(x.id+' · '+x.label)+'</option>';}).join('');
    body.innerHTML='<div class="card"><div class="card-sub">Partner status</div><div class="card-title" style="margin-top:5px;">'+escapeHtml(String(a.status||'pending').toUpperCase())+'</div><div class="card-sub" style="margin-top:5px;">Referral code: <b>'+escapeHtml(a.referral_code||'Pending approval')+'</b></div></div>'+
      '<div class="grid grid-cols-2 gap-3"><div class="card"><div class="card-sub">Available balance</div><div class="clean-money-value tab-num" style="font-size:20px;">'+money(w.available_balance)+'</div></div><div class="card"><div class="card-sub">Total earned</div><div class="clean-money-value tab-num" style="font-size:20px;">'+money(w.total_earned)+'</div></div></div>'+
      '<div class="card"><div class="card-title">Partner overview</div><div class="profile-row"><span>Referrals</span><b>'+(d.referrals||[]).length+'</b></div><div class="profile-row"><span>Trading commissions</span><b>'+(d.commissions||[]).length+'</b></div><div class="profile-row"><span>Deposit commissions</span><b>'+(d.depositCommissions||[]).length+'</b></div></div>'+
      '<div class="card"><div class="card-title">Transfer commission to Real account</div>'+selectField('Destination account','bb-partner-account',accountOpts||'<option value="">No Real account available</option>')+field('Amount (USD)','bb-partner-amount','number','0.00')+'<button class="primary-btn" style="width:100%;" onclick="submitPartnerTransfer()">Transfer funds</button></div>'+
      '<div class="card"><div class="card-title">Recent commissions</div>'+((d.commissions||[]).slice(0,8).map(function(x){return '<div class="trade-item" style="cursor:default;"><div><b>'+escapeHtml(x.symbol||'Trading commission')+'</b><div class="card-sub">'+escapeHtml(String(x.status||'pending').toUpperCase())+' · '+escapeHtml(new Date(x.created_at).toLocaleDateString())+'</div></div><b class="tab-num">'+money(x.commission_usd)+'</b></div>';}).join('')||'<div class="card-sub">No commissions yet.</div>')+'</div>';
  };
  window.submitPartnerTransfer=function(){emit('PARTNER_TRANSFER',{accountId:value('bb-partner-account'),amount:value('bb-partner-amount')});toast('Submitting partner commission transfer…');};
  window.submitPartnerApplication = function () {
    emit('PARTNER_APPLY', {partner_type:'ib',business_name:value('bb-partner-name'),website_or_social:value('bb-partner-link'),audience_size:value('bb-partner-audience'),experience:value('bb-partner-experience')});
    toast('Submitting partner application…');
  };
  window.openTicketPrecheck = function () {
    if(typeof htmlOpenTicketPrecheck==='function') htmlOpenTicketPrecheck();
  };
  window.submitPrecheckedTicket = function () {
    emit('SUPPORT_SUBMIT',{subject:value('tk-subject'),category:'general',message:value('tk-desc')});
    toast('Submitting support ticket…');
  };
  window.openLiveChatAssistant = function () { window.openTicketPrecheck(); };
  window.openFullSettingsOverlay = function () {
    if(typeof htmlOpenSubpage==='function')htmlOpenSubpage('settings');
    emit('NOTIFICATIONS_INIT');
    emit('APP_LOCK_INIT');
    emit('BIOMETRIC_INIT');
  };
  function ensureAppLockRow(data){
    var body=byId('subpage-body');if(!body)return;
    var cards=body.querySelectorAll('.card'),securityCard=null;
    cards.forEach(function(card){if((card.textContent||'').includes('Set new PIN'))securityCard=card;});
    if(!securityCard)return;
    var row=byId('bb-app-lock-row');
    if(!row){row=document.createElement('div');row.id='bb-app-lock-row';row.className='profile-row';}
    row.innerHTML='<div style="font-size:13px;font-weight:800;">App Lock</div><span class="label-circle-badge">'+(data.native?(data.enabled?'ON':'OFF'):'Android only')+' &rsaquo;</span>';
    var pinRow=Array.from(securityCard.querySelectorAll('.profile-row')).find(function(x){return (x.textContent||'').includes('Set new PIN');});
    if(pinRow)securityCard.insertBefore(row,pinRow);else securityCard.appendChild(row);
    row.onclick=function(){if(!data.native){toast('Secure App Lock is available in the installed Android app only.');return;}if(data.enabled){emit('APP_LOCK_DISABLE');}else window.openSetPinSheet();};
  }
  window.openSubpage = function (name) {
    if(name==='settings'){window.openFullSettingsOverlay();return;}
    if(name==='profile'||name==='personal_details'){window.openProfileEditSheet();return;}
    if(name==='verification'||name==='kyc'){window.openKycSheet();return;}
    if(name==='support_hub'){window.openTicketPrecheck();return;}
    if(name==='ib'||name==='partner'){window.openIbPortal();return;}
    if(name==='copy'){openSheet('<div class="card-title-row"><div class="card-title">Copy Trading</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub" style="margin:10px 0;">Copy Trading is not enabled on the connected BIGBULLS backend. No strategy allocation or investment has been created.</div>');return;}
    if(name==='suggest'){window.openTicketPrecheck();return;}
    if(name==='legal'){openSheet('<div class="card-title-row"><div class="card-title">Legal documents</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub">Official legal documents are not currently published through the connected client portal. Contact BIGBULLS support for the current agreements and risk disclosures.</div>');return;}
    if(typeof htmlOpenSubpage==='function')htmlOpenSubpage(name);
  };
  window.openSetPinSheet = function () {
    openSheet('<div class="card-title-row"><div class="card-title">Set App Lock PIN</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub" style="margin:8px 0 12px;">Your six-digit PIN is stored in Android secure storage and checked by the BIGBULLS App Lock screen.</div>'+field('New 6-digit PIN','new-pin-input','password','000000')+'<button class="primary-btn" style="width:100%;margin-top:8px;" onclick="saveNewPin()">Save secure PIN</button>');
    var pinInput=byId('new-pin-input');if(pinInput){pinInput.maxLength=6;pinInput.inputMode='numeric';}
  };
  window.saveNewPin = function () { var pin=value('new-pin-input');if(!/^\d{6}$/.test(pin)){toast('Enter exactly 6 digits.');return;}emit('APP_PIN_SAVE',{pin:pin});toast('Saving PIN in Android secure storage…'); };
  window.cycleSkipPinInterval = function () { toast('PIN timeout preference is not configurable yet.'); };
  window.cycleSettingsLanguage = function () { toast('The BIGBULLS portal is currently available in English.'); };
  window.setAiLot = function (lot) {
    appState.aiLot=Number(lot)||0.01;appState.lotSize=appState.aiLot;setText('exec-lot-val',appState.lotSize.toFixed(2));
    document.querySelectorAll('.lot-choice').forEach(function(btn){btn.classList.toggle('active',Number(btn.getAttribute('data-ailot'))===appState.aiLot);});
    toast('Lot size selected for manual chart orders: '+appState.aiLot.toFixed(2));
  };
  window.toggleSettingsSwitch = function (key,row) {
    if(key==='biometrics'){emit('BIOMETRIC_TOGGLE',{enabled:!appState.settings.biometrics});return;}
    if(key==='notifications'){emit('NOTIFICATIONS_TOGGLE',{enabled:!appState.settings.notifications});return;}
  };
  window.openReferralSheet = function () { window.openIbPortal(); };
  window.openLiveChatAssistant = function () { window.openTicketPrecheck(); };
  window.openSubpage = function (name) {
    if (name === 'verification' || name === 'kyc') window.openKycSheet();
    else if (name === 'support_hub') window.openTicketPrecheck();
    else if (name === 'ib' || name === 'partner') window.openIbPortal();
    else if (name === 'settings') window.openFullSettingsOverlay();
    else if (name === 'copy') {
      openSheet('<div class="card-title-row"><div class="card-title">Copy Trading</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub" style="margin:10px 0;">Copy Trading is not enabled on the connected BIGBULLS backend. No strategy allocation or investment has been created.</div>');
    } else if (name === 'suggest') window.openTicketPrecheck();
    else if (name === 'legal') openSheet('<div class="card-title-row"><div class="card-title">Legal documents</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div class="card-sub">Official legal documents are not currently published through the connected client portal. Contact BIGBULLS support for the current agreements and risk disclosures.</div>');
    else toast('This section is not enabled on the connected BIGBULLS services.');
  };
  window.openPerfAccountModal = function () {
    var modal=byId('perf-acc-modal'), list=byId('perf-acc-options-list'); if(!modal||!list)return;
    var options=[{key:'all',title:'All accounts',sub:'All closed trades currently synced',badge:'ALL'},
      {key:'real',title:'Real accounts ('+(appState.accounts.real||[]).length+')',sub:'Real B-Book trading history',badge:'REAL'},
      {key:'demo',title:'Demo accounts ('+(appState.accounts.demo||[]).length+')',sub:'Demo paper-trading history',badge:'DEMO'}];
    list.innerHTML=options.map(function(o){return '<button type="button" class="perf-opt-card'+(appState.perfAccountFilter===o.key?' selected':'')+'" onclick="selectPerfAccountFilter(\''+o.key+'\')"><div><div style="display:flex;align-items:center;gap:7px;"><span class="tab-num" style="font-size:13.5px;font-weight:900;color:var(--navy);">'+o.title+'</span><span class="label-circle-badge">'+o.badge+'</span></div><div class="card-sub" style="margin-top:3px;">'+o.sub+'</div></div><span class="perf-radio-dot"></span></button>';}).join('');
    modal.classList.remove('hidden');
  };
  window.toggleAiAutoTrade = function () { toast('AI auto-execution is disabled until server-side risk controls are enabled.'); };
  window.executeAiSignal = function () { toast('AI signal execution is not enabled; no simulated order was placed.'); };
  window.renderBbAiTab = function(){
    if(typeof htmlRenderBbAiTab==='function')htmlRenderBbAiTab();
    document.querySelectorAll('#ai-signals-list .primary-btn').forEach(function(btn){btn.textContent='Review chart';});
    var ev=byId('ai-events-list'),news=byId('ai-news-list'),signals=byId('ai-signals-list');
    if(ev&&!(appState.aiEvents||[]).length)ev.innerHTML='<div class="card-sub">Live economic calendar is not connected to this backend yet.</div>';
    if(news&&!(appState.aiNews||[]).length)news.innerHTML='<div class="card-sub">Verified live market news feed is not connected yet.</div>';
    if(signals&&!(appState.aiSignals||[]).length)signals.innerHTML='<div class="card-sub">No qualifying live technical setups loaded. Use Scan live market setups.</div>';
  };
  function ensureAiScanButton(){
    var list=byId('ai-signals-list');if(!list||byId('bb-ai-scan-btn'))return;
    var btn=document.createElement('button');btn.id='bb-ai-scan-btn';btn.type='button';btn.className='primary-btn';btn.style.margin='8px 0 12px';btn.textContent='Scan live market setups';
    btn.onclick=function(){emit('BB_AI_SCAN');toast('Scanning live market candles…');};
    list.parentNode.insertBefore(btn,list);
  }
  window.executeAiSignal = function (idx) {
    var signal=(appState.aiSignals||[])[idx];if(!signal)return;
    window.openChartForSymbol(signal.symbol);
    toast('Review the live chart and place the order manually. No trade was auto-executed.');
  };
  window.toggleAiAutoTrade = function () {
    appState.aiAutoTrade=false;
    var sw=byId('ai-auto-switch');if(sw)sw.classList.remove('on');
    toast('Auto-trading remains disabled until server-side AI risk and execution controls are configured.');
  };
    window.askBbAiPrompt = function (promptText) {
    var prompt=String(promptText||'').trim();
    if(!prompt){toast('Enter a market question first.');return;}
    pushAiMessage('You',prompt);
    var symbol=(appState.selectedSymbol||'EURUSD');
    var match=prompt.toUpperCase().match(/\b(EURUSD|GBPUSD|USDJPY|XAUUSD|XAGUSD|BTCUSD|ETHUSD|US30|US500|USTEC)\b/);
    if(match)symbol=match[1];
    emit('BB_AI_ANALYZE',{symbol:symbol,timeframe:appState.timeframe||'1h',prompt:prompt});
  };
  window.submitCustomAiPrompt = function () {
    var input=byId('ai-custom-input');if(!input)return;
    var prompt=input.value.trim();if(!prompt)return;input.value='';
    window.askBbAiPrompt(prompt);
  };
  window.startSafeTickLoop = function () {
    if (appState.tickTimer) clearInterval(appState.tickTimer);
    appState.tickTimer = null;
  };

  window.addEventListener('load', function () { emit('READY'); emit('NOTIFICATIONS_INIT'); });
  emit('READY');
})();
