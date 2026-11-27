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
  var gate = document.createElement('style'); gate.textContent = 'html.bb-sync-pending body{visibility:hidden}'; document.documentElement.classList.add('bb-sync-pending'); document.head.appendChild(gate);
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    var data = event.data || {};
    if (data.source !== 'BIGBULLS_NATIVE_HOST') return;
    if (data.type === 'KYC_DATA') {
      var record=data.record||null, status=document.getElementById('bb-kyc-status');
      if(status) status.textContent=record?'Current status: '+String(record.status||'pending').toUpperCase()+(record.admin_note?' · '+record.admin_note:''):'No verification submitted yet.';
      if(record&&String(record.status).toLowerCase()==='approved'){var form=document.getElementById('bb-kyc-form');if(form)form.style.display='none';}
    } else if (data.type === 'KYC_RESULT') {
      showToast(data.message||'Verification submitted.');
      var status=document.getElementById('bb-kyc-status');if(status)status.textContent='Current status: PENDING REVIEW';
      var form=document.getElementById('bb-kyc-form');if(form)form.style.display='none';
    } else if (data.type === 'FUND_DATA') {
      fundData = data.data || fundData;
      renderLiveFundData();
    } else if (data.type === 'FUND_RESULT') {
      if (data.ok) {
        showToast(data.message || 'Payment request updated.');
        if (data.otpRequired) {
          fundTxnId = data.transactionId || '';
          var otpBox=document.getElementById('bb-fund-otp-box');if(otpBox)otpBox.style.display='block';
        } else if (appState.fundMode === 'deposit') closeFundModal();
      } else showToast(data.message || 'Payment request failed.');
    } else if (data.type === 'STATE') {
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
      appState.aiSignals = []; appState.aiEvents = []; appState.aiNews = []; appState.ibClients = [];
      appState.perfData = s.perfData || appState.perfData;
      appState.perfCurvePoints = s.perfCurvePoints || [];
      appState.email = s.email || '';
      syncAccountHeaderAndCard();
      renderTradesLists();
      renderMarketWatch();
      renderPerformance();
      renderProfileTab();
      var email = document.getElementById('profile-email-txt');
      if (email) email.textContent = s.email || '—';
      document.documentElement.classList.remove('bb-sync-pending');
      var chart = document.getElementById('chart-view'); if (chart && !chart.classList.contains('hidden')) drawMainChart();
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
  window.setChartAccountMode = function (mode) { window.setAccountMode(mode); };
  window.selectChartAccountById = function (id) { window.selectAccountById(id); };
  window.refreshAccountData = function () { emit('REFRESH'); showToast('Refreshing live BIGBULLS account data…'); };
  var fundData = { methods: [], wallets: [], transactions: [], kyc: null, wallet: null };
  var fundTxnId = '';
  function fundField(label, id, type, placeholder) {
    var wrap = document.createElement('label'); wrap.style.cssText = 'display:block;margin:0 0 10px;font-size:12px;font-weight:800;color:#344054;';
    wrap.textContent = label;
    var input = document.createElement(type === 'file' ? 'input' : 'input'); input.id = id; input.type = type;
    input.placeholder = placeholder || ''; input.style.cssText = 'display:block;width:100%;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;font-size:14px;';
    if (type === 'file') input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
    wrap.appendChild(input); return wrap;
  }
  function fundSelect(label, id, items) {
    var wrap = document.createElement('label'); wrap.style.cssText = 'display:block;margin:0 0 10px;font-size:12px;font-weight:800;color:#344054;'; wrap.textContent = label;
    var el = document.createElement('select'); el.id = id; el.style.cssText = 'display:block;width:100%;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;font-size:14px;';
    items.forEach(function (x) { var o=document.createElement('option'); o.value=x.value; o.textContent=x.label; el.appendChild(o); }); wrap.appendChild(el); return wrap;
  }
  function ensureFundFields() {
    var panel = document.querySelector('#fund-modal .sheet-panel'); if (!panel) return null;
    var old = document.getElementById('bb-live-fund-fields'); if (old) return old;
    var box = document.createElement('div'); box.id='bb-live-fund-fields'; box.style.cssText='margin:12px 0;padding:12px;border:1px solid #e5eaf2;border-radius:16px;background:#f8faff;';
    var grid=document.getElementById('payment-methods-grid'); if(grid) grid.style.display='none';
    var amount=document.getElementById('fund-amount-input'); if(amount){amount.value='';amount.placeholder='Enter USD amount';}
    var amountWrap=amount && amount.parentElement; if(amountWrap) amountWrap.style.display='none';
    box.appendChild(fundSelect('Payment method / network','bb-fund-method',[]));
    box.appendChild(fundSelect('Real trading account','bb-fund-account',[]));
    box.appendChild(fundField('Amount (USD)','bb-fund-usd','number','0.00'));
    box.appendChild(fundField('Amount in payment currency','bb-fund-crypto','number','0.00'));
    box.appendChild(fundField('Blockchain TXID (crypto deposit)','bb-fund-txid','text','Transaction hash'));
    box.appendChild(fundField('Withdrawal destination address','bb-fund-destination','text','Wallet address'));
    box.appendChild(fundField('Payment proof (bank / fiat transfer)','bb-fund-proof','file',''));
    panel.insertBefore(box, document.getElementById('fund-submit-btn'));
    var otpBox=document.createElement('div'); otpBox.id='bb-fund-otp-box'; otpBox.style.display='none'; otpBox.style.marginTop='12px';
    var otp=fundField('Email OTP','bb-fund-otp','text','6-digit code'); otpBox.appendChild(otp);
    var verify=document.createElement('button'); verify.type='button'; verify.textContent='Verify withdrawal OTP'; verify.className='primary-btn'; verify.onclick=function(){emit('FUND_VERIFY_OTP',{transactionId:fundTxnId,otp:(document.getElementById('bb-fund-otp')||{}).value||''});}; otpBox.appendChild(verify); panel.insertBefore(otpBox,document.getElementById('fund-submit-btn'));
    return box;
  }
  function renderLiveFundData() {
    var box=ensureFundFields(); if(!box)return;
    var mode=appState.fundMode==='withdraw'?'withdraw':'deposit';
    var methods=mode==='withdraw'?fundData.wallets:fundData.methods;
    var method=document.getElementById('bb-fund-method');
    if(method){var previous=method.value;method.innerHTML='';methods.forEach(function(x){var o=document.createElement('option');o.value=x.id;o.textContent=mode==='withdraw'?(x.asset+' · '+x.network+(x.label?' · '+x.label:'')):x.display_name+' · '+x.network;method.appendChild(o);});if(methods.some(function(x){return x.id===previous;}))method.value=previous;}
    var accounts=document.getElementById('bb-fund-account');
    if(accounts){accounts.innerHTML='';(appState.accounts.real||[]).forEach(function(a){var o=document.createElement('option');o.value=a.backendId;o.textContent=a.id+' · '+a.label+' · '+Number(a.balance||0).toFixed(2)+' USD';accounts.appendChild(o);});}
    var withdraw=mode==='withdraw';
    ['bb-fund-txid','bb-fund-proof'].forEach(function(id){var el=document.getElementById(id);if(el)el.parentElement.style.display=withdraw?'none':'block';});
    var dest=document.getElementById('bb-fund-destination');if(dest)dest.parentElement.style.display=withdraw?'block':'none';
    var submit=document.getElementById('fund-submit-btn');if(submit)submit.textContent=withdraw?'Submit Withdrawal Request':'Submit Deposit Request';
  }
  window.openFundModal = function (mode) {
    appState.fundMode = mode === 'withdraw' ? 'withdraw' : 'deposit';
    setText('fund-modal-title', mode === 'withdraw' ? 'Withdraw Funds' : 'Deposit Funds');
    var modal=document.getElementById('fund-modal');if(modal)modal.classList.remove('hidden');
    ensureFundFields();renderLiveFundData();emit('FUND_INIT');
  };
  window.submitFundRequest = function () {
    var get=function(id){var el=document.getElementById(id);return el?el.value:'';};
    var methodId=get('bb-fund-method');var methods=appState.fundMode==='withdraw'?fundData.wallets:fundData.methods;
    var method=methods.find(function(x){return x.id===methodId;});
    if(!method){showToast('No active payment method is available.');return;}
    var proofEl=document.getElementById('bb-fund-proof');
    emit('FUND_SUBMIT',{mode:appState.fundMode,methodId:methodId,accountId:get('bb-fund-account'),amountUsd:get('bb-fund-usd'),amountCrypto:get('bb-fund-crypto'),asset:method.asset,network:method.network,txHash:get('bb-fund-txid'),destination:get('bb-fund-destination'),proof:proofEl&&proofEl.files?proofEl.files[0]||null:null});
    showToast('Submitting secure payment request…');
  };

  function kycField(label,id,type,placeholder){return '<label style="display:block;margin:0 0 10px;font-size:12px;font-weight:800;color:#344054;">'+label+'<input id="'+id+'" type="'+type+'" placeholder="'+(placeholder||'')+'" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:12px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#182230;font-size:14px;" /></label>';}
  window.openKycSheet=function(){
    openProfileSheet('<div class="card-title-row"><div class="card-title">Identity verification</div><button class="circle-icon-btn" onclick="closeProfileSheet()">&times;</button></div><div id="bb-kyc-status" class="card-sub" style="margin:8px 0 14px;">Loading verification status…</div><div id="bb-kyc-form"><div style="font-size:13px;font-weight:900;margin-bottom:10px;">Personal details</div>'+kycField('Full legal name','bb-kyc-name','text','As shown on document')+kycField('First name','bb-kyc-first','text','First name')+kycField('Last name','bb-kyc-last','text','Last name')+kycField('Date of birth','bb-kyc-dob','date','')+kycField('Country','bb-kyc-country','text','Country')+kycField('Residential address','bb-kyc-address','text','Full address')+'<div style="font-size:13px;font-weight:900;margin:12px 0 8px;">Identity document</div><select id="bb-kyc-type" style="width:100%;padding:12px;border:1px solid #dbe3ef;border-radius:12px;margin-bottom:10px;"><option value="passport">Passport</option><option value="national_id">National ID card</option><option value="driving_license">Driving licence</option></select>'+kycField('Document number','bb-kyc-number','text','Document number')+kycField('Front side (100 KB–20 MB)','bb-kyc-front','file','')+kycField('Back side (100 KB–20 MB)','bb-kyc-back','file','')+'<button class="primary-btn" style="width:100%;margin-top:8px;" onclick="submitKycFromHtml()">Submit verification</button></div>');
    emit('KYC_INIT');
  };
  window.submitKycFromHtml=function(){
    var val=function(id){var e=document.getElementById(id);return e?e.value.trim():'';};
    var front=document.getElementById('bb-kyc-front'),back=document.getElementById('bb-kyc-back');
    emit('KYC_SUBMIT',{values:{legal_name:val('bb-kyc-name'),first_name:val('bb-kyc-first'),last_name:val('bb-kyc-last'),date_of_birth:val('bb-kyc-dob'),country:val('bb-kyc-country'),residential_address:val('bb-kyc-address'),document_type:val('bb-kyc-type'),document_number:val('bb-kyc-number')},front:front&&front.files?front.files[0]||null:null,back:back&&back.files?back.files[0]||null:null});
    showToast('Submitting identity verification…');
  };
    window.executeInternalTransfer = function () { emit('NAVIGATE', { path: '/transfer' }); };
  window.openNewAccount = function () { emit('NAVIGATE', { path: '/legacy/accounts' }); };
  window.openFullSettingsOverlay = function () { emit('NAVIGATE', { path: '/profile' }); };
  window.openIbPortal = function () { emit('NAVIGATE', { path: '/partner' }); };
  window.openTicketPrecheck = function () { emit('NAVIGATE', { path: '/support' }); };
  window.openLiveChatAssistant = function () { emit('NAVIGATE', { path: '/support' }); };
  window.openWalletSheet = function () { emit('NAVIGATE', { path: '/wallet' }); };
  window.openReferralSheet = function () { emit('NAVIGATE', { path: '/partner' }); };
  window.openSubpage = function (name) {
    if (name === 'verification' || name === 'kyc') window.openKycSheet();
    else if (name === 'support_hub' || name === 'copy') emit('NAVIGATE', { path: '/support' });
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
