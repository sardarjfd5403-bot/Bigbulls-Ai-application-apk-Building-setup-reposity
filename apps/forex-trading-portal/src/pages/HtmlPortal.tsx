import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTrading } from '../lib/store';
import { supabase } from '../lib/supabase';
import { bigbullsBackend } from '../lib/bigbullsBackend';
import { fetchCandles } from '../lib/feed';
import { Capacitor } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import { readAppPin, saveAppPin, removeAppPin, readBiometricEnabled, saveBiometricEnabled } from '../lib/appLock';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

type PortalMessage = { source?: string; action?: string; payload?: any };
export default function HtmlPortal() {
  const frame = useRef<HTMLIFrameElement>(null);
  const trading = useTrading();
  const navigate = useNavigate();

  const sendSnapshot = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const account = trading.account;
    const all = trading.state.accounts;
    const mapAccount = (a: typeof account) => ({
      id: '#' + a.number, backendId: a.id, label: a.kind, balance: a.balance,
      leverage: '1:' + a.leverage, type: a.type
    });
    const byMode = {
      real: all.filter(a => a.type === 'Real').map(mapAccount),
      demo: all.filter(a => a.type === 'Demo').map(mapAccount)
    };
    const activeId = account.id ? '#' + account.number : '';
    const positions = trading.state.positions.filter(p => p.accountId === account.id).map(p => ({
      id: p.id, symbol: p.symbol, side: p.side.toUpperCase(), lots: p.volume,
      openPrice: p.openPrice, sl: p.sl || 0, tp: p.tp || 0, pnl: p.floating ?? 0
    }));
    const closed = trading.state.history.filter(p => p.accountId === account.id).map(p => ({
      id: p.id, symbol: p.symbol, side: p.side.toUpperCase(), lots: p.volume,
      pnl: p.profit, time: new Date(p.closeTime).toLocaleString()
    }));
    const instruments = Object.entries(trading.quotes).map(([symbol, q]: [string, any]) => ({
      symbol, bid: Number(q.bid), ask: Number(q.ask), digits: Number(q.digits || (symbol.includes('JPY') ? 3 : 5)),
      dir: q.direction || 'up'
    }));
    const allClosed = trading.state.history;
    const makeStats = (rows: typeof allClosed, days: number) => {
      const cutoff = days ? Date.now() - days * 86400000 : 0;
      const filtered = rows.filter(p => p.closeTime >= cutoff);
      const profits = filtered.filter(p => p.profit > 0).reduce((n,p) => n+p.profit,0);
      const losses = Math.abs(filtered.filter(p => p.profit < 0).reduce((n,p) => n+p.profit,0));
      const net = profits - losses;
      return { net, pf: losses ? profits/losses : (profits ? profits : 0), win: filtered.length ? filtered.filter(p=>p.profit>0).length/filtered.length*100 : 0,
        closed: filtered.length, vol: filtered.reduce((n,p) => n+p.volume,0).toFixed(2)+' Lots',
        profit: profits, loss: losses, best: Math.max(0,...filtered.map(p=>p.profit)), avg: filtered.length ? net/filtered.length : 0 };
    };
    const scoped = {
      all: allClosed,
      real: allClosed.filter(p=>all.some(a=>a.id===p.accountId&&a.type==='Real')),
      demo: allClosed.filter(p=>all.some(a=>a.id===p.accountId&&a.type==='Demo')),
    };
    const perfDataByFilter = Object.fromEntries(Object.entries(scoped).map(([key,rows])=>[key,{'7D':makeStats(rows,7),'30D':makeStats(rows,30),'ALL':makeStats(rows,0)}]));
    const perfData = perfDataByFilter[account.type==='Real'?'real':'demo'];
    const perfCurvePointsByFilter = Object.fromEntries(Object.entries(scoped).map(([key,rows])=>{
      let total=0;const points=[0];
      rows.slice().sort((a,b)=>a.closeTime-b.closeTime).forEach(p=>{total+=p.profit;points.push(total);});
      return [key,points];
    }));
    frame.current?.contentWindow?.postMessage({
      source: 'BIGBULLS_NATIVE_HOST', type: 'STATE',
      state: {
        accounts: byMode, accountMode: account.type.toLowerCase(), selectedAccountId: {
          real: byMode.real.some(a=>a.backendId===account.id) ? activeId : byMode.real[0]?.id || '',
          demo: byMode.demo.some(a=>a.backendId===account.id) ? activeId : byMode.demo[0]?.id || ''
        },
        activeAccountId: account.id, runningTrades: positions, pendingOrders: trading.state.pending.filter(p=>p.accountId===account.id).map(p=>({id:p.id,symbol:p.symbol,side:p.side.toUpperCase(),kind:p.kind,lots:p.volume,price:p.price,sl:p.sl||0,tp:p.tp||0})), closedTrades: closed,
        instruments, equity: trading.equity, floating: trading.floating,
        email: data.user?.email || '', perfData, perfDataByFilter, perfCurvePointsByFilter,
        perfCurvePoints: allClosed.filter(p=>p.accountId===account.id).slice().reverse().reduce((arr,p)=>{arr.push((arr[arr.length-1]||0)+p.profit);return arr;},[0])
      }
    }, window.location.origin);
  }, [trading.account, trading.state, trading.quotes, trading.equity, trading.floating]);

  const sendFundData = useCallback(async () => {
    const [methods, wallets, transactions, kyc, wallet] = await Promise.all([
      bigbullsBackend.depositMethodSettings(), bigbullsBackend.cryptoWallets(),
      bigbullsBackend.walletTransactions(), bigbullsBackend.kyc(), bigbullsBackend.walletBalance()
    ]);
    frame.current?.contentWindow?.postMessage({
      source: 'BIGBULLS_NATIVE_HOST', type: 'FUND_DATA',
      data: { methods, wallets, transactions, kyc, wallet }
    }, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = async (event: MessageEvent<PortalMessage>) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.source !== 'BIGBULLS_HTML_PORTAL') return;
      const { action, payload = {} } = event.data;
      try {
        switch (action) {
          case 'READY': await sendSnapshot(); await sendFundData(); break;
          case 'FUND_INIT': await sendFundData(); break;
          case 'BB_AI_SCAN': {
            const symbols=['EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSD'];
            const results=await Promise.all(symbols.map(async(symbol)=>{
              try{
                const candles=await fetchCandles(symbol,'1h',120);if(candles.length<30)return null;
                const close=candles.map((x:any)=>Number(x.c));
                const calcEma=(period:number)=>{const k=2/(period+1);let v=close.slice(0,period).reduce((n:number,x:number)=>n+x,0)/period;for(let i=period;i<close.length;i++)v=close[i]*k+v*(1-k);return v;};
                let gain=0,loss=0;for(let i=close.length-14;i<close.length;i++){const d=close[i]-close[i-1];if(d>0)gain+=d;else loss-=d;}
                const avgGain=gain/14,avgLoss=loss/14,rsi=avgLoss===0?100:100-(100/(1+avgGain/avgLoss));
                const e9=calcEma(9),e21=calcEma(21),dir=e9>e21&&rsi>=50&&rsi<68?'BUY':e9<e21&&rsi>32&&rsi<=50?'SELL':'';
                if(!dir)return null;
                const digits=symbol.includes('JPY')?3:(symbol==='XAUUSD'?2:(symbol==='BTCUSD'?1:5));
                const recent=candles.slice(-30),entry=close[close.length-1],support=Math.min(...recent.map((x:any)=>Number(x.l))),resistance=Math.max(...recent.map((x:any)=>Number(x.h)));
                const sl=dir==='BUY'?support:resistance, risk=Math.abs(entry-sl);if(!risk)return null;
                const tp=dir==='BUY'?entry+risk*2:entry-risk*2;
                return {symbol,dir,conf:'Technical',entry:entry.toFixed(digits),sl:sl.toFixed(digits),tp:tp.toFixed(digits),series:close.slice(-24),rsi:Number(rsi.toFixed(1))};
              }catch{return null;}
            }));
            const signals=results.filter(Boolean);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'BB_AI_SIGNALS',signals},window.location.origin);
            break;
          }
          case 'BB_AI_ANALYZE': {
            const symbol=String(payload.symbol||'EURUSD');
            const timeframe=String(payload.timeframe||'1h');
            const candles=await fetchCandles(symbol,timeframe,200);
            if(candles.length<30)throw new Error('Not enough live historical candles are available for this instrument.');
            const closes=candles.map((x:any)=>Number(x.c));
            const ema=(period:number)=>{const k=2/(period+1);let v=closes.slice(0,period).reduce((n:number,x:number)=>n+x,0)/period;for(let i=period;i<closes.length;i++)v=closes[i]*k+v*(1-k);return v;};
            let gains=0,losses=0;for(let i=closes.length-14;i<closes.length;i++){const d=closes[i]-closes[i-1];if(d>0)gains+=d;else losses-=d;}
            const avgGain=gains/14,avgLoss=losses/14, rsi=avgLoss===0?100:100-(100/(1+avgGain/avgLoss));
            const last=closes[closes.length-1], e9=ema(9),e21=ema(21);
            const recent=candles.slice(-30),support=Math.min(...recent.map((x:any)=>Number(x.l))),resistance=Math.max(...recent.map((x:any)=>Number(x.h)));
            const bias=e9>e21&&rsi>=50&&rsi<70?'Bullish':e9<e21&&rsi>30&&rsi<=50?'Bearish':'Neutral / mixed';
            const digits=symbol.includes('JPY')?3:(symbol==='XAUUSD'?2:5);
            const report={symbol,timeframe,price:last.toFixed(digits),ema9:e9.toFixed(digits),ema21:e21.toFixed(digits),rsi:rsi.toFixed(1),support:support.toFixed(digits),resistance:resistance.toFixed(digits),bias,candles:candles.length};
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'BB_AI_RESULT',report},window.location.origin);
            break;
          }
          case 'GET_CANDLES': {
            const symbol=String(payload.symbol||'EURUSD'), timeframe=String(payload.timeframe||'1m');
            const candles=await fetchCandles(symbol,timeframe,500);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'CANDLES',symbol,timeframe,candles},window.location.origin);
            break;
          }
          case 'WALLET_INIT': {
            const [balance, ledger, tx] = await Promise.all([bigbullsBackend.walletBalance(), bigbullsBackend.walletLedger(), bigbullsBackend.walletTransactions()]);
            frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'WALLET_DATA', data:{balance,ledger,transactions:tx} }, window.location.origin);
            break;
          }
          case 'TRANSFER_SUBMIT': {
            const amount=Number(payload.amount);
            if (!(amount>0)) throw new Error('Enter a valid transfer amount.');
            await bigbullsBackend.clientFundsTransfer({fromType:payload.fromType==='wallet'?'wallet':'account',fromAccountId:payload.fromType==='wallet'?null:String(payload.fromAccountId||''),toType:payload.toType==='wallet'?'wallet':'account',toAccountId:payload.toType==='wallet'?null:String(payload.toAccountId||''),amount,note:String(payload.note||'BIGBULLS client transfer')});
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'transfer',ok:true,message:'Transfer completed successfully.'},window.location.origin);
            await trading.refresh(); await sendSnapshot();
            break;
          }
          case 'SUPPORT_INIT': {
            const tickets=await bigbullsBackend.supportTickets();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'SUPPORT_DATA',tickets},window.location.origin);
            break;
          }
          case 'FEATURE_SUGGESTION': {
            const suggestion=String(payload.suggestion||'').trim();
            if(suggestion.length<10)throw new Error('Please describe your feature idea in at least 10 characters.');
            const ticket=await bigbullsBackend.createSupportTicket({subject:'Client feature suggestion',category:'feature_suggestion',message:suggestion});
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'suggestion',ok:true,message:'Feature suggestion submitted to BIGBULLS.'},window.location.origin);
            break;
          }
          case 'SUPPORT_SUBMIT': {
            const subject=String(payload.subject||'').trim(), message=String(payload.message||'').trim();
            if(subject.length<3||message.length<10)throw new Error('Enter a subject and a message of at least 10 characters.');
            const ticket=await bigbullsBackend.createSupportTicket({subject,category:String(payload.category||'general'),message});
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'support',ok:true,message:'Support ticket created: '+ticket.id},window.location.origin);
            break;
          }
          case 'PARTNER_INIT': {
            const data=await bigbullsBackend.partnerDashboard();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'PARTNER_DATA',data},window.location.origin);
            break;
          }
          case 'PARTNER_TRANSFER': {
            const amount=Number(payload.amount);
            if(!(amount>0))throw new Error('Enter a valid partner-wallet transfer amount.');
            await bigbullsBackend.partnerTransferToRealAccount(String(payload.accountId||''),amount);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'partner_transfer',ok:true,message:'Partner commission transfer submitted.'},window.location.origin);
            const data=await bigbullsBackend.partnerDashboard();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'PARTNER_DATA',data},window.location.origin);
            await trading.refresh();await sendSnapshot();
            break;
          }
          case 'PARTNER_APPLY': {
            const data=await bigbullsBackend.applyPartner({partner_type:String(payload.partner_type||'ib'),business_name:String(payload.business_name||''),website_or_social:String(payload.website_or_social||''),audience_size:String(payload.audience_size||''),experience:String(payload.experience||'')});
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'partner',ok:true,message:'Partner application submitted for review.',data},window.location.origin);
            break;
          }
          case 'MFA_INIT': {
            const {data,error}=await supabase.auth.mfa.listFactors(); if(error)throw error;
            const verified=(data?.totp||[]).filter((f:any)=>f.status==='verified');
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'MFA_DATA',enabled:verified.length>0,factors:verified.map((f:any)=>({id:f.id,friendlyName:f.friendly_name}))},window.location.origin);
            break;
          }
          case 'MFA_ENROLL': {
            const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'BIGBULLS Authenticator'});
            if(error)throw error;
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'MFA_ENROLL_DATA',factorId:data.id,qrCode:data.totp.qr_code,secret:data.totp.secret},window.location.origin);
            break;
          }
          case 'MFA_VERIFY': {
            const factorId=String(payload.factorId||''), code=String(payload.code||'').trim();
            if(!factorId||!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit authenticator code.');
            const {data:challenge,error:challengeError}=await supabase.auth.mfa.challenge({factorId});
            if(challengeError)throw challengeError;
            const {error}=await supabase.auth.mfa.verify({factorId,challengeId:challenge.id,code});
            if(error)throw error;
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'mfa',ok:true,message:'Two-factor authentication enabled.'},window.location.origin);
            const {data}=await supabase.auth.mfa.listFactors();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'MFA_DATA',enabled:(data?.totp||[]).some((f:any)=>f.status==='verified'),factors:(data?.totp||[]).filter((f:any)=>f.status==='verified').map((f:any)=>({id:f.id,friendlyName:f.friendly_name}))},window.location.origin);
            break;
          }
          case 'MFA_DISABLE': {
            const {error}=await supabase.auth.mfa.unenroll({factorId:String(payload.factorId||'')});
            if(error)throw error;
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'mfa',ok:true,message:'Two-factor authentication disabled.'},window.location.origin);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'MFA_DATA',enabled:false,factors:[]},window.location.origin);
            break;
          }
          case 'APP_LOCK_INIT': {
            const {data,error}=await supabase.auth.getUser();if(error)throw error;
            const enabled=await bigbullsBackend.getAppLockSettings();
            const pin=Capacitor.isNativePlatform()&&data.user?.id?await readAppPin(data.user.id):null;
            const biometricEnabled=Capacitor.isNativePlatform()&&data.user?.id?await readBiometricEnabled(data.user.id):false;
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'APP_LOCK_DATA',enabled:enabled&&!!pin,pinSet:!!pin,biometricEnabled,native:Capacitor.isNativePlatform()},window.location.origin);
            break;
          }
          case 'APP_PIN_SAVE': {
            const pin=String(payload.pin||'');
            if(!/^\d{6}$/.test(pin))throw new Error('App Lock PIN must contain exactly 6 digits.');
            if(!Capacitor.isNativePlatform())throw new Error('Secure App Lock PIN is available in the installed Android app only.');
            const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw error||new Error('Sign in again.');
            await saveAppPin(data.user.id,pin);
            await bigbullsBackend.setAppLockEnabled(true);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'APP_LOCK_RESULT',ok:true,message:'Six-digit App Lock enabled securely on this device.'},window.location.origin);
            break;
          }
          case 'BIOMETRIC_INIT': {
            if(!Capacitor.isNativePlatform())break;
            const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw error||new Error('Sign in again.');
            const check=await BiometricAuth.checkBiometry();
            const enabled=await readBiometricEnabled(data.user.id);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'BIOMETRIC_DATA',available:check.isAvailable,enabled},window.location.origin);
            break;
          }
          case 'BIOMETRIC_TOGGLE': {
            if(!Capacitor.isNativePlatform())throw new Error('Biometric sign-in is available in the installed Android app only.');
            const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw error||new Error('Sign in again.');
            const enabled=!!payload.enabled;
            if(enabled){
              const check=await BiometricAuth.checkBiometry();
              if(!check.isAvailable)throw new Error('Enroll a fingerprint or face unlock in Android settings first.');
              const pin=await readAppPin(data.user.id);
              if(!pin)throw new Error('Set your six-digit App Lock PIN before enabling biometric sign-in.');
              await BiometricAuth.authenticate({reason:'Enable biometric sign-in for BIGBULLS',cancelTitle:'Cancel',allowDeviceCredential:false,androidTitle:'Enable BIGBULLS biometric sign-in',androidSubtitle:'Confirm your identity'});
            }
            await saveBiometricEnabled(data.user.id,enabled);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'BIOMETRIC_RESULT',enabled,message:enabled?'Biometric sign-in enabled. App PIN remains your fallback.':'Biometric sign-in disabled.'},window.location.origin);
            break;
          }
          case 'APP_LOCK_DISABLE': {
            if(!Capacitor.isNativePlatform())throw new Error('App Lock is available in the installed Android app only.');
            const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw error||new Error('Sign in again.');
            await removeAppPin(data.user.id);
            await saveBiometricEnabled(data.user.id,false);
            await bigbullsBackend.setAppLockEnabled(false);
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'APP_LOCK_RESULT',ok:true,message:'App Lock disabled.'},window.location.origin);
            break;
          }
          case 'NOTIFICATIONS_INIT': {
            if(!Capacitor.isNativePlatform())break;
            const enabled=await OneSignal.User.pushSubscription.getOptedInAsync();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'NOTIFICATIONS_RESULT',enabled:!!enabled,message:''},window.location.origin);
            break;
          }
          case 'NOTIFICATIONS_TOGGLE': {
            if (!Capacitor.isNativePlatform()) throw new Error('Push notification preferences can be changed in the installed BIGBULLS app.');
            const enabled=!!payload.enabled;
            if(enabled){
              const granted=await OneSignal.Notifications.hasPermission();
              if(!granted)await OneSignal.Notifications.requestPermission(true);
              const permission=await OneSignal.Notifications.hasPermission();
              if(!permission)throw new Error('Android notification permission was not granted.');
              await OneSignal.User.pushSubscription.optIn();
            }else await OneSignal.User.pushSubscription.optOut();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'NOTIFICATIONS_RESULT',enabled,message:enabled?'BIGBULLS notifications enabled.':'BIGBULLS notifications paused.'},window.location.origin);
            break;
          }
          case 'AUTH_PASSWORD_UPDATE': {
            const password=String(payload.password||'');
            if(password.length<8)throw new Error('Password must contain at least 8 characters.');
            const {error}=await supabase.auth.updateUser({password});
            if(error)throw error;
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'password',ok:true,message:'Account password updated successfully.'},window.location.origin);
            break;
          }
          case 'PROFILE_INIT': {
            const data=await bigbullsBackend.profile();
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'PROFILE_DATA',data},window.location.origin);
            break;
          }
          case 'PROFILE_SAVE': {
            const data=await bigbullsBackend.updateProfile({full_name:String(payload.full_name||''),country:String(payload.country||''),phone:String(payload.phone||'')});
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'profile',ok:true,message:'Profile saved.',data},window.location.origin);
            break;
          }
          case 'KYC_INIT': {
            const record = await bigbullsBackend.kyc();
            frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'KYC_DATA', record }, window.location.origin);
            break;
          }
          case 'KYC_SUBMIT': {
            const v = payload.values || {};
            if (!v.legal_name || !v.date_of_birth || !v.country || !v.residential_address || !v.document_type || !v.document_number) throw new Error('Complete all identity fields.');
            if (!(payload.front && payload.back)) throw new Error('Upload both front and back document images.');
            const frontPath = await bigbullsBackend.uploadKycDocument(payload.front as File, 'front');
            const backPath = await bigbullsBackend.uploadKycDocument(payload.back as File, 'back');
            const submitted = await bigbullsBackend.submitKyc({ legal_name:String(v.legal_name), first_name:String(v.first_name||''), last_name:String(v.last_name||''), date_of_birth:String(v.date_of_birth), country:String(v.country), residential_address:String(v.residential_address), document_type:String(v.document_type), document_number:String(v.document_number), document_front_path:frontPath, document_back_path:backPath });
            frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'KYC_RESULT', ok:true, message:'Verification submitted. Status: Pending review.', record:submitted }, window.location.origin);
            break;
          }
          case 'FUND_SUBMIT': {
            const mode = payload.mode === 'withdraw' ? 'withdrawal' : 'deposit';
            const amountUsd = Number(payload.amountUsd);
            const cryptoAmount = Number(payload.amountCrypto);
            if (!(amountUsd > 0) || !(cryptoAmount > 0)) throw new Error('Enter valid USD and payment amounts.');
            const account = trading.state.accounts.find(a => a.id === payload.accountId) || trading.account;
            if (!account?.id || account.type !== 'Real') throw new Error('Select an active Real trading account.');
            let asset = String(payload.asset || 'USDT');
            let network = String(payload.network || 'TRC20');
            let destination = String(payload.destination || '').trim();
            let txHash = String(payload.txHash || '').trim();
            let proofPath: string | undefined;
            if (mode === 'deposit') {
              const methods = await bigbullsBackend.depositMethodSettings();
              const method = methods.find((m: any) => m.id === payload.methodId);
              if (!method) throw new Error('Choose an active payment method.');
              asset = method.asset; network = method.network;
              if (amountUsd < Number(method.min_amount_usd || 0) || (method.max_amount_usd != null && amountUsd > Number(method.max_amount_usd))) throw new Error('Amount is outside this payment method limit.');
              const isCrypto = method.method_type === 'crypto';
              const depositWallets = method.method_type === 'crypto' ? await bigbullsBackend.cryptoWallets() : [];
              const cryptoWallet = depositWallets.find((w:any)=>w.id===method.crypto_wallet_id);
              destination = method.method_type === 'crypto' ? (cryptoWallet?.address || method.destination_details) : [method.account_title, method.account_number, method.destination_details].filter(Boolean).join(' · ');
              if (isCrypto && txHash.length <= 10) throw new Error('Enter the blockchain transaction hash.');
              if (!isCrypto && !(payload.proof && typeof payload.proof.size === 'number' && typeof payload.proof.name === 'string')) throw new Error('Upload your bank/payment receipt.');
              if (payload.proof && typeof payload.proof.size === 'number' && typeof payload.proof.name === 'string') proofPath = await bigbullsBackend.uploadPaymentProof(payload.proof as File);
            } else {
              const wallets = await bigbullsBackend.cryptoWallets();
              const wallet = wallets.find((w: any) => w.id === payload.methodId);
              if (!wallet) throw new Error('Choose an active withdrawal network.');
              asset = wallet.asset; network = wallet.network;
              if (destination.length < 10) throw new Error('Enter a valid destination wallet address.');
              if (!['approved','verified'].includes(String((await bigbullsBackend.kyc())?.status || '').toLowerCase())) throw new Error('Complete KYC verification before requesting a withdrawal.');
            }
            const created = await bigbullsBackend.submitWalletTransaction({ account_id: account.id, kind: mode, asset, network, destination_address: destination, amount_crypto: cryptoAmount, amount_usd: amountUsd, ...(txHash ? { tx_hash: txHash } : {}), ...(proofPath ? { proof_path: proofPath } : {}) });
            if (mode === 'withdrawal') {
              let otpSent = true;
              try { await bigbullsBackend.requestWithdrawalOtp(created.id); } catch { otpSent = false; }
              frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, message:otpSent ? 'Withdrawal request saved. Email OTP sent; verify it to continue.' : 'Withdrawal request saved, but email OTP could not be sent. Retry OTP below.', transactionId:created.id, otpRequired:true, otpSent }, window.location.origin);
            } else {
              frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, message:'Deposit request submitted for admin review. Balance changes only after approval.' }, window.location.origin);
            }
            await sendFundData(); await trading.refresh(); await sendSnapshot(); break;
          }
          case 'FUND_RESEND_OTP': {
            await bigbullsBackend.requestWithdrawalOtp(String(payload.transactionId));
            frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, message:'A new withdrawal OTP has been sent.' }, window.location.origin);
            break;
          }
          case 'FUND_VERIFY_OTP': {
            await bigbullsBackend.verifyWithdrawalOtp(String(payload.transactionId), String(payload.otp));
            frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, otpVerified:true, message:'Email OTP verified. Withdrawal is awaiting back-office approval.' }, window.location.origin);
            await sendFundData(); break;
          }
          case 'REFRESH': await trading.refresh(); await sendSnapshot(); break;
          case 'SWITCH_ACCOUNT': {
            const found = trading.state.accounts.find(a => a.number === String(payload.accountNumber).replace(/^#/, '') || a.id === payload.accountId);
            if (!found) throw new Error('This trading account is not available on your profile.');
            trading.setActive(found.id); break;
          }
          case 'OPEN_ORDER': {
            const side = String(payload.side).toLowerCase() as 'buy'|'sell';
            const symbol = String(payload.symbol);
            const volume = Number(payload.lots);
            if (!(volume > 0)) throw new Error('Enter a valid lot size.');
            if (payload.mode === 'MARKET') await trading.openPosition({ symbol, side, volume });
            else await trading.placePending({ symbol, side, kind: payload.mode === 'LIMIT' ? 'Limit' : 'Stop', volume, price: Number(payload.price) });
            await sendSnapshot(); break;
          }
          case 'CLOSE_POSITION': await trading.closePosition(String(payload.id)); await sendSnapshot(); break;
          case 'CANCEL_PENDING': await trading.cancelPending(String(payload.id)); await sendSnapshot(); break;
          case 'MODIFY_POSITION': await trading.modifyPosition(String(payload.id), Number(payload.sl)||undefined, Number(payload.tp)||undefined); await sendSnapshot(); break;
          case 'NAVIGATE': navigate(String(payload.path || '/')); break;
          case 'OPEN_ACCOUNT': {
            const created = await trading.openAccount({ type: payload.type === 'real' ? 'Real' : 'Demo', kind: payload.kind || 'Standard', platform: 'BIGBULLS', leverage: Number(payload.leverage)||100 });
            if (!created) throw new Error('Account creation did not complete. Check the account service and try again.');
            frame.current?.contentWindow?.postMessage({source:'BIGBULLS_NATIVE_HOST',type:'WORKFLOW_RESULT',workflow:'account',ok:true,message:'Trading account created.'},window.location.origin);
            await sendSnapshot(); break;
          }
          default: console.warn('Unsupported BIGBULLS HTML portal action:', action);
        }
      } catch (error: any) {
        toast.error(error?.message || 'BIGBULLS request failed');
        frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'ACTION_ERROR', message:error?.message || 'Request failed' }, window.location.origin);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate, sendSnapshot, sendFundData, trading]);

  useEffect(() => { void sendSnapshot(); }, [sendSnapshot]);

  return <iframe ref={frame} title="BIGBULLS Global Market Client Portal" src="/bigbulls-master-portal.html"
    onLoad={() => void sendSnapshot()} className="fixed inset-0 h-[100dvh] w-full border-0 bg-[#f4f7fc]"
    allow="clipboard-read; clipboard-write; camera; microphone" />;
}
