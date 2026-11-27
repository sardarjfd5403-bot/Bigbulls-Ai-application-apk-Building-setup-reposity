/* BIGBULLS production bridge: HTML portal actions are delegated to authenticated Supabase services. */
(function () {
  'use strict';
  var fundData = { methods: [], wallets: [], transactions: [], wallet: null };
  var fundTxnId = '';

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
    return (appState.accounts.real || []).concat(appState.accounts.demo || []).map(function (a) {
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
      appState.perfData = s.perfData || appState.perfData;
      appState.perfCurvePoints = s.perfCurvePoints || [];
      appState.email = s.email || '';
      syncAccountHeaderAndCard();
      renderTradesLists();
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
    } else if (data.type === 'KYC_DATA') {
      var record = data.record || null;
      var status = byId('bb-kyc-status');
      if (status) {
        status.textContent = record ? 'Current status: ' + String(record.status || 'pending').toUpperCase() : 'No verification submitted yet.';
        if (record && record.admin_note) status.textContent += ' · ' + record.admin_note;
        if (record && record.rejection_reasons && record.rejection_reasons.length) status.textContent += ' · ' + record.rejection_reasons.join(', ');
      }
      if (record && ['approved', 'pending'].includes(String(record.status).toLowerCase())) {
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
      var partnerBox = byId('bb-partner-data');
      var applyBox = byId('bb-partner-apply');
      var pd = data.data || {};
      var application = pd.application || {};
      var pw = pd.wallet || {};
      if (partnerBox) partnerBox.innerHTML =
        '<b>Status:</b> ' + escapeHtml(String(application.status || 'Not registered').toUpperCase()) +
        '<br><b>Referral code:</b> ' + escapeHtml(application.referral_code || 'Not assigned') +
        '<br><b>Partner wallet:</b> $' + Number(pw.available_balance || 0).toFixed(2) +
        '<br><b>Total earned:</b> $' + Number(pw.total_earned || 0).toFixed(2) +
        '<br><b>Referrals:</b> ' + (pd.referrals || []).length +
        '<br><b>Trading commissions:</b> ' + (pd.commissions || []).length;
      if (applyBox) applyBox.style.display = (!pd.application || ['rejected', 'not_approved'].includes(String(application.status).toLowerCase())) ? 'block' : 'none';
    } else if (data.type === 'SUPPORT_DATA') {
      var supportBox = byId('bb-support-history');
      if (supportBox) supportBox.innerHTML = '<b>Your recent tickets</b>' + ((data.tickets || []).slice(0, 8).map(function (t) {
        return '<div style="padding:7px 0;border-bottom:1px solid #e5eaf2;">' + escapeHtml(t.subject) + ' · <b>' +
          escapeHtml(String(t.status || '').toUpperCase()) + '</b><br><span style="font-size:11px;">' +
          escapeHtml(t.admin_reply || t.message || '') + '</span></div>';
      }).join('') || '<div>No support tickets yet.</div>');
    } else if (data.type === 'PROFILE_DATA') {
      var profile = data.data || {};
      if (byId('bb-profile-name')) byId('bb-profile-name').value = profile.full_name || '';
      if (byId('bb-profile-country')) byId('bb-profile-country').value = profile.country || '';
      if (byId('bb-profile-phone')) byId('bb-profile-phone').value = profile.phone || '';
      if (byId('bb-profile-email')) byId('bb-profile-email').textContent = profile.email || appState.email || '';
    } else if (data.type === 'WORKFLOW_RESULT') {
      if (data.ok) {
        toast(data.message || 'Saved successfully.');
        if (data.workflow === 'transfer') { window.refreshAccountData(); closeProfileSheet(); }
        if (data.workflow === 'account') closeProfileSheet();
        if (data.workflow === 'support') emit('SUPPORT_INIT');
        if (data.workflow === 'profile') emit('PROFILE_INIT');
        if (data.workflow === 'partner') { var partnerForm = byId('bb-partner-apply'); if (partnerForm) partnerForm.style.display = 'none'; emit('PARTNER_INIT'); }
      } else toast(data.message || 'Request failed.');
    } else if (data.type === 'ACTION_ERROR') {
      toast(data.message || 'Request failed');
    }
  });

  window.generateChartCandles = function () {
    emit('GET_CANDLES', { symbol: appState.selectedSymbol, timeframe: appState.timeframe || '1m' });
  };
  window.placeChartOrder = function (side) {
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
    if (type === 'file') input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
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
          escapeHtml(selected.destination_details || selected.account_number || 'Follow the payment instructions.') +
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
    openSheet('<div class="card-title-row"><div class="card-title">IB Partner</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div id="bb-partner-data" class="card-sub" style="margin:12px 0;">Loading partner account…</div><div id="bb-partner-apply" style="display:none;">' +
      field('Business name', 'bb-partner-name', 'text', 'Business name') +
      field('Website or social link', 'bb-partner-link', 'text', 'https://') +
      field('Audience size', 'bb-partner-audience', 'text', 'e.g. 5000') +
      field('Experience', 'bb-partner-experience', 'text', 'Forex / IB experience') +
      '<button class="primary-btn" style="width:100%;" onclick="submitPartnerApplication()">Apply as partner</button></div>');
    emit('PARTNER_INIT');
  };
  window.submitPartnerApplication = function () {
    emit('PARTNER_APPLY', {
      partner_type: 'ib', business_name: value('bb-partner-name'),
      website_or_social: value('bb-partner-link'), audience_size: value('bb-partner-audience'),
      experience: value('bb-partner-experience')
    });
    toast('Submitting partner application…');
  };
  window.openTicketPrecheck = function () {
    openSheet('<div class="card-title-row"><div class="card-title">BIGBULLS Support</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div id="bb-support-history" class="card-sub" style="margin:8px 0 14px;">Loading your tickets…</div>' +
      field('Subject', 'bb-support-subject', 'text', 'How can we help?') +
      selectField('Category', 'bb-support-category', '<option value="account">Account</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="trading">Trading</option><option value="technical">Technical</option><option value="general">General</option>') +
      '<label style="display:block;margin-bottom:10px;font-size:12px;font-weight:800;color:#344054;">Message<textarea id="bb-support-message" rows="4" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;"></textarea></label>' +
      '<button class="primary-btn" style="width:100%;" onclick="submitHtmlSupport()">Create support ticket</button>');
    emit('SUPPORT_INIT');
  };
  window.submitHtmlSupport = function () {
    emit('SUPPORT_SUBMIT', { subject: value('bb-support-subject'), category: value('bb-support-category'), message: value('bb-support-message') });
    toast('Creating support ticket…');
  };
  window.openFullSettingsOverlay = function () {
    openSheet('<div class="card-title-row"><div class="card-title">Profile settings</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div>' +
      '<div id="bb-profile-email" class="card-sub" style="margin:8px 0;">Loading profile…</div>' +
      field('Full name', 'bb-profile-name', 'text', 'Full name') + field('Country', 'bb-profile-country', 'text', 'Country') +
      field('Phone', 'bb-profile-phone', 'tel', '+92') +
      '<button class="primary-btn" style="width:100%;" onclick="saveHtmlProfile()">Save profile</button>');
    emit('PROFILE_INIT');
  };
  window.saveHtmlProfile = function () {
    emit('PROFILE_SAVE', { full_name: value('bb-profile-name'), country: value('bb-profile-country'), phone: value('bb-profile-phone') });
    toast('Saving profile…');
  };
  window.openReferralSheet = function () { window.openIbPortal(); };
  window.openLiveChatAssistant = function () { window.openTicketPrecheck(); };
  window.openSubpage = function (name) {
    if (name === 'verification' || name === 'kyc') window.openKycSheet();
    else if (name === 'support_hub' || name === 'copy') window.openTicketPrecheck();
    else if (name === 'ib' || name === 'partner') window.openIbPortal();
    else toast('This section is not available from the connected BIGBULLS services yet.');
  };
  window.toggleAiAutoTrade = function () { toast('AI auto-execution is disabled until server-side risk controls are enabled.'); };
  window.executeAiSignal = function () { toast('AI signal execution is not enabled; no simulated order was placed.'); };
  window.askBbAiPrompt = function () { toast('Live BB AI analysis service is not connected. No demo answer is shown.'); };
  window.submitCustomAiPrompt = function () { toast('Live BB AI analysis service is not connected.'); };
  window.startSafeTickLoop = function () {
    if (appState.tickTimer) clearInterval(appState.tickTimer);
    appState.tickTimer = null;
  };

  window.addEventListener('load', function () { emit('READY'); });
  emit('READY');
})();
