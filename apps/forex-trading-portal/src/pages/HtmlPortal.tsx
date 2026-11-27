import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTrading } from '../lib/store';
import { supabase } from '../lib/supabase';
import { bigbullsBackend } from '../lib/bigbullsBackend';

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
    const history = trading.state.history.filter(p => p.accountId === account.id);
    const makeStats = (days: number) => {
      const cutoff = days ? Date.now() - days * 86400000 : 0;
      const rows = history.filter(p => p.closeTime >= cutoff);
      const profits = rows.filter(p => p.profit > 0).reduce((n,p) => n+p.profit,0);
      const losses = Math.abs(rows.filter(p => p.profit < 0).reduce((n,p) => n+p.profit,0));
      const net = profits - losses;
      return { net, pf: losses ? profits/losses : (profits ? profits : 0), win: rows.length ? rows.filter(p=>p.profit>0).length/rows.length*100 : 0,
        closed: rows.length, vol: rows.reduce((n,p)=>n+p.volume,0).toFixed(2)+' Lots',
        profit: profits, loss: losses, best: Math.max(0,...rows.map(p=>p.profit)), avg: rows.length ? net/rows.length : 0 };
    };
    const perfData = { '7D': makeStats(7), '30D': makeStats(30), 'ALL': makeStats(0) };
    frame.current?.contentWindow?.postMessage({
      source: 'BIGBULLS_NATIVE_HOST', type: 'STATE',
      state: {
        accounts: byMode, accountMode: account.type.toLowerCase(), selectedAccountId: {
          real: byMode.real.some(a=>a.backendId===account.id) ? activeId : byMode.real[0]?.id || '',
          demo: byMode.demo.some(a=>a.backendId===account.id) ? activeId : byMode.demo[0]?.id || ''
        },
        activeAccountId: account.id, runningTrades: positions, closedTrades: closed,
        instruments, equity: trading.equity, floating: trading.floating,
        email: data.user?.email || '', perfData,
        perfCurvePoints: history.slice().reverse().reduce((arr,p)=>{arr.push((arr[arr.length-1]||0)+p.profit);return arr;},[0])
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
              destination = method.method_type === 'crypto' ? method.destination_details : [method.account_title, method.account_number, method.destination_details].filter(Boolean).join(' · ');
              if (isCrypto && txHash.length <= 10) throw new Error('Enter the blockchain transaction hash.');
              if (!isCrypto && !(payload.proof && typeof payload.proof.size === 'number' && typeof payload.proof.name === 'string')) throw new Error('Upload your bank/payment receipt.');
              if (payload.proof && typeof payload.proof.size === 'number' && typeof payload.proof.name === 'string') proofPath = await bigbullsBackend.uploadPaymentProof(payload.proof as File);
            } else {
              const wallets = await bigbullsBackend.cryptoWallets();
              const wallet = wallets.find((w: any) => w.id === payload.methodId);
              if (!wallet) throw new Error('Choose an active withdrawal network.');
              asset = wallet.asset; network = wallet.network;
              if (destination.length < 10) throw new Error('Enter a valid destination wallet address.');
              if (String((await bigbullsBackend.kyc())?.status || '').toLowerCase() !== 'approved') throw new Error('Complete KYC verification before requesting a withdrawal.');
            }
            const created = await bigbullsBackend.submitWalletTransaction({ account_id: account.id, kind: mode, asset, network, destination_address: destination, amount_crypto: cryptoAmount, amount_usd: amountUsd, ...(txHash ? { tx_hash: txHash } : {}), ...(proofPath ? { proof_path: proofPath } : {}) });
            if (mode === 'withdrawal') {
              await bigbullsBackend.requestWithdrawalOtp(created.id);
              frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, message:'Withdrawal request saved. Email OTP sent; verify it to continue.', transactionId:created.id, otpRequired:true }, window.location.origin);
            } else {
              frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, message:'Deposit request submitted for admin review. Balance changes only after approval.' }, window.location.origin);
            }
            await sendFundData(); await trading.refresh(); await sendSnapshot(); break;
          }
          case 'FUND_VERIFY_OTP': {
            await bigbullsBackend.verifyWithdrawalOtp(String(payload.transactionId), String(payload.otp));
            frame.current?.contentWindow?.postMessage({ source:'BIGBULLS_NATIVE_HOST', type:'FUND_RESULT', ok:true, message:'Email OTP verified. Withdrawal is awaiting back-office approval.' }, window.location.origin);
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
          case 'MODIFY_POSITION': await trading.modifyPosition(String(payload.id), Number(payload.sl)||undefined, Number(payload.tp)||undefined); await sendSnapshot(); break;
          case 'NAVIGATE': navigate(String(payload.path || '/')); break;
          case 'OPEN_ACCOUNT': {
            await trading.openAccount({ type: payload.type === 'real' ? 'Real' : 'Demo', kind: payload.kind || 'Standard', platform: 'BIGBULLS', leverage: Number(payload.leverage)||100 });
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
