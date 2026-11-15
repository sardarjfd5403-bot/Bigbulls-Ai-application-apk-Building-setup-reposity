import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { Quotes, initialQuotes, subscribePrices, quoteToUsd } from './feed';
import { SYM, SYMBOLS } from './symbols';
import { bigbullsBackend, TradingAccountRow } from './bigbullsBackend';
import { supabase } from './supabase';

export type Side = 'buy' | 'sell';
export type Account = { id:string; number:string; type:'Real'|'Demo'; platform:string; kind:'Standard'|'Pro'|'Raw Spread'|'Zero'; leverage:number; balance:number; currency:'USD' };
export type Position = { id:string; accountId:string; symbol:string; side:Side; volume:number; openPrice:number; sl?:number; tp?:number; openTime:number; floating?:number };
export type Pending = { id:string; accountId:string; symbol:string; side:Side; kind:'Limit'|'Stop'; volume:number; price:number; sl?:number; tp?:number; created:number };
export type Closed = Position & { closePrice:number; closeTime:number; profit:number; reason:string };
export type Txn = { id:string; accountId:string; type:'Deposit'|'Withdrawal'|'Transfer'; method:string; amount:number; status:'Done'|'Pending'; time:number };
type State = { accounts:Account[]; activeId:string; positions:Position[]; pending:Pending[]; history:Closed[]; txns:Txn[]; favorites:string[] };
const emptyState:State={accounts:[],activeId:'',positions:[],pending:[],history:[],txns:[],favorites:['EURUSD','XAUUSD','BTCUSD','GBPUSD','USDJPY','US30']};
const executionSymbol=(s:string)=>({BTCUSD:'BTCUSDT',ETHUSD:'ETHUSDT',SOLUSD:'SOLUSDT',XRPUSD:'XRPUSDT',BNBUSD:'BNBUSDT'} as Record<string,string>)[s]||s;
const mapAccount=(a:TradingAccountRow):Account=>({id:a.id,number:String(a.account_number),type:a.account_mode==='real'?'Real':'Demo',platform:a.platform||'BigBulls Terminal',kind:(a.account_type||'Standard') as Account['kind'],leverage:Number(String(a.requested_leverage||'100').replace(/^1:/,''))||100,balance:Number(a.balance||0),currency:'USD'});
const mapPosition=(p:any):Position=>({id:p.id,accountId:p.account_id,symbol:p.symbol,side:String(p.side).toLowerCase()==='buy'?'buy':'sell',volume:Number(p.quantity),openPrice:Number(p.entry_price),sl:p.stop_loss==null?undefined:Number(p.stop_loss),tp:p.take_profit==null?undefined:Number(p.take_profit),openTime:Date.parse(p.opened_at||p.created_at||new Date().toISOString()),floating:Number(p.floating_pnl??p.unrealized_pnl??0)});
export function pnl(p:Position,_q:Quotes){return Number(p.floating||0);}
export function marginFor(symbol:string,volume:number,leverage:number,q:Quotes){const s=SYM[symbol];if(!s||!q[symbol])return 0;return volume*s.contract*q[symbol].ask*quoteToUsd(symbol,q)/Math.max(1,leverage);}
function useEngine(){
 const [quotes,setQuotes]=useState<Quotes>(initialQuotes);
 const [state,setState]=useState<State>(emptyState);
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  const rows=await bigbullsBackend.accounts();
  const accounts=rows.filter(a=>a.status==='approved'&&!a.archived_at&&!a.deleted_at).map(mapAccount);
  setState(old=>({...old,accounts,activeId:accounts.some(a=>a.id===old.activeId)?old.activeId:(accounts[0]?.id||'')}));
 },[]);
 const refreshAccount=useCallback(async(accountId:string)=>{
  const account=state.accounts.find(a=>a.id===accountId); if(!account)return;
  if(account.type==='Real'){
   const result:any=await bigbullsBackend.realStatus(accountId);
   const all=(result.positions||[]).map(mapPosition);
   const active=all.filter((p:Position)=>!((result.positions||[]).find((x:any)=>x.id===p.id)?.status!=='OPEN'));
   const closed=(result.positions||[]).filter((p:any)=>p.status==='CLOSED').map((p:any)=>({...mapPosition(p),closePrice:Number(p.mark_price||p.exit_price||p.entry_price),closeTime:Date.parse(p.closed_at||p.opened_at),profit:Number(p.realized_pnl||0),reason:p.close_reason||'Closed'}));
   const {data:orders,error}=await supabase.from('bb_bbook_pending_orders').select('*').eq('account_id',accountId).eq('status','PENDING').order('created_at',{ascending:false});
   if(error)throw error;
   const pending=(orders||[]).map((o:any)=>({id:o.id,accountId,symbol:o.symbol,side:o.side.toLowerCase(),kind:(String(o.order_type).includes('LIMIT')?'Limit':'Stop') as 'Limit'|'Stop',volume:Number(o.quantity),price:Number(o.target_price),sl:o.stop_loss==null?undefined:Number(o.stop_loss),tp:o.take_profit==null?undefined:Number(o.take_profit),created:Date.parse(o.created_at)}));
   setState(old=>({...old,accounts:old.accounts.map(a=>a.id===accountId?{...a,balance:Number(result.metrics?.balance??a.balance)}:a),positions:old.positions.filter(p=>p.accountId!==accountId).concat(active),pending:old.pending.filter(p=>p.accountId!==accountId).concat(pending),history:old.history.filter(p=>p.accountId!==accountId).concat(closed)}));
  }else{
   const result:any=await bigbullsBackend.demoStatus(accountId);
   const trades=result.trades||[];
   const active=trades.filter((p:any)=>p.status==='OPEN').map(mapPosition);
   const closed=trades.filter((p:any)=>p.status==='CLOSED').map((p:any)=>({...mapPosition(p),closePrice:Number(p.exit_price||p.mark_price||p.entry_price),closeTime:Date.parse(p.closed_at||p.opened_at),profit:Number(p.realized_pnl||0),reason:p.close_reason||'Closed'}));
   const balance=Number(result.ledger?.virtual_balance??result.ledger?.balance??account.balance);
   setState(old=>({...old,accounts:old.accounts.map(a=>a.id===accountId?{...a,balance}:a),positions:old.positions.filter(p=>p.accountId!==accountId).concat(active),pending:old.pending.filter(p=>p.accountId!==accountId),history:old.history.filter(p=>p.accountId!==accountId).concat(closed)}));
  }
 },[state.accounts]);
 useEffect(()=>{const stop=subscribePrices(setQuotes);let alive=true;refresh().catch(e=>toast.error(e.message||'Unable to load trading accounts'));return()=>{alive=false;stop();};},[refresh]);
 useEffect(()=>{if(!state.activeId)return;refreshAccount(state.activeId).catch(e=>console.warn('Account refresh failed',e));const id=setInterval(()=>refreshAccount(state.activeId).catch(()=>{}),5000);return()=>clearInterval(id);},[state.activeId,refreshAccount]);
 useEffect(()=>{let alive=true;supabase.auth.getUser().then(({data})=>{if(!alive||!data.user)return;const channel=bigbullsBackend.subscribeClientData(data.user.id,()=>{refresh().then(()=>{if(state.activeId)refreshAccount(state.activeId);}).catch(()=>{});});return channel;});return()=>{alive=false;};},[refresh,refreshAccount,state.activeId]);
 const account=state.accounts.find(a=>a.id===state.activeId)||state.accounts[0]||{id:'',number:'—',type:'Demo' as const,platform:'BigBulls Terminal',kind:'Standard' as const,leverage:100,balance:0,currency:'USD' as const};
 const positions=state.positions.filter(p=>p.accountId===account.id),pending=state.pending.filter(p=>p.accountId===account.id),history=state.history.filter(p=>p.accountId===account.id);
 const floating=positions.reduce((n,p)=>n+pnl(p,quotes),0),margin=positions.reduce((n,p)=>n+marginFor(p.symbol,p.volume,account.leverage,quotes),0),equity=account.balance+floating,free=equity-margin,level=margin>0?equity/margin*100:0;
 const run=async(fn:()=>Promise<any>,success?:string)=>{if(busy)return false;setBusy(true);try{await fn();await refresh();if(account.id)await refreshAccount(account.id);if(success)toast.success(success);return true;}catch(e:any){toast.error(e?.message||'BIGBULLS server request failed');return false;}finally{setBusy(false);}};
 const actions={
  setActive:(id:string)=>setState(s=>({...s,activeId:id})),
  toggleFav:(sym:string)=>setState(s=>({...s,favorites:s.favorites.includes(sym)?s.favorites.filter(x=>x!==sym):[...s.favorites,sym]})),
  openPosition:(o:{symbol:string;side:Side;volume:number;sl?:number;tp?:number})=>{if(!account.id)return false;return run(async()=>{if(account.type==='Real')await bigbullsBackend.realOpen(account.id,{symbol:executionSymbol(o.symbol),side:o.side.toUpperCase() as 'BUY'|'SELL',quantity:o.volume,stop_loss:o.sl??null,take_profit:o.tp??null});else{if(!o.sl)throw new Error('Demo paper trades require a Stop Loss.');await bigbullsBackend.demoOpen(account.id,{symbol:o.symbol,side:o.side.toUpperCase() as 'BUY'|'SELL',quantity:o.volume,stop_loss:o.sl,take_profit:o.tp??null});}},'Order request sent to BIGBULLS execution engine');},
  placePending:(o:Omit<Pending,'id'|'accountId'|'created'>)=>{if(!account.id||account.type!=='Real'){toast.error('Pending orders are currently supported by the Real B-Book engine only.');return false;}return run(()=>bigbullsBackend.realPending(account.id,{symbol:o.symbol,side:o.side.toUpperCase() as 'BUY'|'SELL',order_type:o.kind.toUpperCase(),quantity:o.volume,target_price:o.price,stop_loss:o.sl??null,take_profit:o.tp??null}),'Pending order submitted to BIGBULLS');},
  cancelPending:(id:string)=>run(()=>bigbullsBackend.realCancelPending(account.id,id),'Pending order cancelled'),
  closePosition:(id:string)=>run(()=>account.type==='Real'?bigbullsBackend.realClose(account.id,id):bigbullsBackend.demoClose(account.id,id),'Close request sent to execution engine'),
  closeAll:(filter:'all'|'profit'|'loss')=>run(async()=>{const selected=positions.filter(p=>filter==='all'||(filter==='profit'?pnl(p,quotes)>0:pnl(p,quotes)<0));for(const p of selected){if(account.type==='Real')await bigbullsBackend.realClose(account.id,p.id);else await bigbullsBackend.demoClose(account.id,p.id);}},'Close requests submitted'),
  modifyPosition:(id:string,sl?:number,tp?:number)=>run(()=>account.type==='Real'?bigbullsBackend.realModify(account.id,id,sl??null,tp??null):bigbullsBackend.demoModify(account.id,id,sl??0,tp??null),'Stop Loss / Take Profit update submitted'),
  transact:(_accountId:string,_type:any,_method:string,_amount:number)=>{toast.error('Use the secure BIGBULLS payment workflow; local balance credit is disabled.');return false;},
  transfer:(_fromId:string,_toId:string,_amount:number)=>{toast.error('Local transfers are disabled until the existing server transfer workflow is wired.');return false;},
  openAccount:(a:{type:'Real'|'Demo';kind:Account['kind'];platform:string;leverage:number})=>run(async()=>{const {data,error}=await supabase.rpc('create_client_trading_account',{p_account_mode:a.type.toLowerCase(),p_account_type:a.kind,p_leverage:String(a.leverage)});if(error)throw error;if(!data)throw new Error('Account request was not accepted.');},'Account request submitted'),
  walletMove:(_accountId:string,_amount:number)=>{toast.error('Local wallet mutation is disabled.');return false;},
  setLeverage:(_id:string,_leverage:number)=>{toast.error('Leverage changes require the existing account-management workflow.');},
  resetDemo:(id:string)=>run(()=>bigbullsBackend.demoSetBalance(id,10000,'set'),'Demo balance reset requested'),
  archive:(_id:string)=>{toast.error('Account archiving is controlled by the existing back office.');},
 };
 return {quotes,state,account,positions,pending,history,floating,margin,equity,free,level,busy,refresh,...actions};
}
type Engine=ReturnType<typeof useEngine>;
const Ctx=createContext<Engine|null>(null);
export function TradingProvider({children}:{children:ReactNode}){const engine=useEngine();const value=useMemo(()=>engine,[engine]);return <Ctx.Provider value={value}>{children}</Ctx.Provider>;}
export const useTrading=()=>{const c=useContext(Ctx);if(!c)throw new Error('useTrading outside provider');return c;};
