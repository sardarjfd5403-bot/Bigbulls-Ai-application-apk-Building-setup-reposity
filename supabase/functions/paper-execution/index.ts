import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const ALLOWED_ORIGINS = new Set(["https://bigbullsglobalmarket.is-an.ai","https://localhost","http://localhost","capacitor://localhost","ionic://localhost"]);
const cors = {"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const corsFor=(origin:string|null)=>({...cors,"Access-Control-Allow-Origin":origin&&ALLOWED_ORIGINS.has(origin)?origin:"https://bigbullsglobalmarket.is-an.ai"});
const reply=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...corsFor(origin),"Content-Type":"application/json","Cache-Control":"no-store"}});
const norm=(s:string)=>s.toUpperCase().replaceAll("/","");
const contract=(s:string)=>["EURUSD","GBPUSD","USDJPY"].includes(s)?100000:s==="XAUUSD"?100:1;
const allowed=new Set(["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"]);
const num=(v:unknown)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error("A valid numeric value is required.");return n;};
async function quoteFor(symbol:string,url:string,anon:string,admin:any,allowCached=true):Promise<number>{
 const s=norm(symbol);
 if(s.endsWith("USDT")){const r=await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol="+encodeURIComponent(s),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error("Crypto quote provider unavailable ("+r.status+").");const d=await r.json();const p=Number(d.price);if(!(p>0))throw new Error("Invalid crypto quote.");return p;}
 const provider=({EURUSD:"EUR/USD",GBPUSD:"GBP/USD",USDJPY:"USD/JPY",XAUUSD:"XAU/USD"} as Record<string,string>)[s];
 if(!provider)throw new Error("No Twelve Data quote mapping exists for "+symbol+".");
 const r=await fetch(url+"/functions/v1/market-data",{method:"POST",headers:{"Content-Type":"application/json",apikey:anon,Authorization:"Bearer "+anon},body:JSON.stringify({action:"quote",symbol:provider}),signal:AbortSignal.timeout(10000)});
 if(r.ok){const d=await r.json();const p=Number(d.price);if(p>0)return p;}
 if(allowCached){const {data,error}=await admin.from("bb_bbook_quotes").select("mid").eq("symbol",s).maybeSingle();if(!error&&Number(data?.mid)>0)return Number(data.mid);}
 throw new Error("Fresh market quote unavailable for "+symbol+" (market-data service unavailable).");
}
function costs(symbol:string,side:string,qty:number,mid:number){const s=norm(symbol);const bps=s==="XAUUSD"?3:s.endsWith("USDT")?8:1.2;const half=mid*bps/20000;const slip=mid*.5/10000;const fill=side==="BUY"?mid+half+slip:mid-half-slip;const size=contract(s);return {fill,spread_cost:half*qty*size,slippage:slip*qty*size,commission:s.endsWith("USDT")?mid*qty*.0005:3.5*qty};}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin");
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsFor(origin)});
 if(req.method!=="POST")return reply({error:"POST required."},405,origin);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY");
  if(!url||!anon||!service)return reply({error:"Server execution credentials are not configured."},503,origin);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");if(!token)return reply({error:"Authentication required."},401,origin);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+token}}});
  const {data:authData,error:authError}=await auth.auth.getUser(token);if(authError||!authData.user)return reply({error:"Invalid or expired session."},401,origin);
  const user=authData.user,admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({})),action=String(body.action||"status"),accountId=body.account_id?String(body.account_id):null,mode=String(body.account_mode||(accountId?"":"demo"));
  const {data:isAdmin,error:adminErr}=await auth.rpc("is_bigbulls_admin");if(adminErr)throw adminErr;
  const targetUserId=isAdmin===true&&body.user_id?String(body.user_id):user.id;
  if(!["demo","real"].includes(mode))return reply({error:"Unsupported account mode."},400,origin);
  let account:any=null;
  if(accountId){const {data,error}=await admin.from("trading_accounts").select("id,user_id,account_mode,status,currency,archived_at,deleted_at").eq("id",accountId).eq("user_id",targetUserId).maybeSingle();if(error)throw error;account=data;if(!account||account.account_mode!==mode||account.status!=="approved"||account.archived_at||account.deleted_at)return reply({error:"Approved account not found or account access is restricted."},403,origin);}
  else if(mode!=="demo")return reply({error:"A linked approved account is required."},400,origin);
  if(mode==="real"&&isAdmin!==true){const {data:kyc,error}=await auth.from("kyc_submissions").select("status").eq("user_id",user.id).eq("status","approved").maybeSingle();if(error)throw error;if(!kyc)return reply({error:"Real-account test execution requires approved KYC.",code:"KYC_APPROVAL_REQUIRED"},403,origin);}
  const {data:settings,error:settingsErr}=await admin.from("bb_execution_settings").select("paper_execution_enabled,demo_execution_enabled,global_halt").eq("singleton",true).single();if(settingsErr)throw settingsErr;
  if(settings.global_halt||!settings.paper_execution_enabled||(mode==="demo"&&!settings.demo_execution_enabled))return reply({error:"Paper execution is currently disabled by the administrator.",code:"EXECUTION_HALTED"},423,origin);
  const {error:insertErr}=await admin.from("bb_paper_execution_accounts").insert({account_id:accountId,user_id:targetUserId,account_mode:mode});if(insertErr&&insertErr.code!=="23505")throw insertErr;
  let lq=admin.from("bb_paper_execution_accounts").select("*").eq("user_id",targetUserId).eq("account_mode",mode);lq=accountId?lq.eq("account_id",accountId):lq.is("account_id",null);
  const {data:ledger,error:ledgerErr}=await lq.single();if(ledgerErr)throw ledgerErr;
  if(action==="status"||action==="refresh"){
   const {data:trades,error}=await admin.from("bb_paper_execution_trades").select("*").eq("paper_account_id",ledger.id).eq("user_id",targetUserId).order("opened_at",{ascending:false}).limit(500);if(error)throw error;
   const prices:Record<string,number>={};for(const s of [...new Set((trades||[]).filter((t:any)=>t.status==="OPEN").map((t:any)=>t.symbol))] as string[]){try{prices[s]=await quoteFor(s,url,anon,admin,true);}catch{}}
   for(const t of (trades||[]).filter((x:any)=>x.status==="OPEN")){const mid=prices[t.symbol];if(!(mid>0))continue;const floating=(t.side==="BUY"?mid-Number(t.entry_price):Number(t.entry_price)-mid)*Number(t.quantity)*contract(norm(t.symbol));const {error:updateErr}=await admin.from("bb_paper_execution_trades").update({mark_price:mid,unrealized_pnl:floating}).eq("id",t.id).eq("paper_account_id",ledger.id).eq("status","OPEN");if(updateErr)throw updateErr;}
   const [{data:freshLedger,error:le},{data:freshTrades,error:te}]=await Promise.all([admin.from("bb_paper_execution_accounts").select("*").eq("id",ledger.id).single(),admin.from("bb_paper_execution_trades").select("*").eq("paper_account_id",ledger.id).eq("user_id",targetUserId).order("opened_at",{ascending:false}).limit(500)]);if(le||te)throw le||te;
   return reply({account:{id:accountId,account_mode:mode,currency:account?.currency||"USD"},execution:{mode:"PAPER",label:"Paper execution · testing only",broker_routing:false,paper_enabled:true},ledger:freshLedger,trades:freshTrades||[],prices,generated_at:new Date().toISOString()},200,origin);
  }
  if(action==="open"){
   const source=String(body.source||"MANUAL");if(source.toUpperCase().startsWith("AI")&&ledger.auto_enabled!==true)return reply({error:"AI automation is not enabled for this account.",code:"AUTO_DISABLED"},423,origin);
   const symbol=norm(String(body.symbol||"")),side=String(body.side||"").toUpperCase(),quantity=num(body.quantity),sl=body.stop_loss==null||body.stop_loss===""?null:num(body.stop_loss),tp=body.take_profit==null||body.take_profit===""?null:num(body.take_profit);
   if(!allowed.has(symbol))return reply({error:"Instrument is not enabled for this paper engine."},400,origin);if(!["BUY","SELL"].includes(side)||quantity<=0)return reply({error:"Invalid side or quantity."},400,origin);
   const mid=await quoteFor(symbol,url,anon,admin,true),c=costs(symbol,side,quantity,mid),trailing=body.trailing_distance==null?0:num(body.trailing_distance);
   if(sl!=null&&((side==="BUY"&&sl>=c.fill)||(side==="SELL"&&sl<=c.fill)))return reply({error:"Stop loss must be beyond the current market price."},400,origin);
   if(tp!=null&&((side==="BUY"&&tp<=c.fill)||(side==="SELL"&&tp>=c.fill)))return reply({error:"Take profit must be beyond the current market price."},400,origin);
   const {data,error}=await admin.rpc("bb_paper_open_position",{p:{user_id:user.id,account_id:accountId,paper_account_id:ledger.id,account_mode:mode,symbol,side,quantity,fill_price:c.fill,stop_loss:sl,take_profit:tp,spread_cost:c.spread_cost,commission:c.commission,slippage:c.slippage,source:source.slice(0,80)}});if(error)throw error;
   if(trailing>0&&data?.trade?.id){const {error:e}=await admin.from("bb_paper_execution_trades").update({trailing_distance:trailing}).eq("id",data.trade.id).eq("paper_account_id",ledger.id);if(e)throw e;}
   return reply({success:true,...data,quote:mid,execution:{mode:"PAPER",broker_routing:false}},200,origin);
  }
  if(action==="close"){
   const tradeId=String(body.trade_id||"");const {data:trade,error}=await admin.from("bb_paper_execution_trades").select("id,symbol,side,quantity").eq("id",tradeId).eq("paper_account_id",ledger.id).eq("user_id",targetUserId).eq("status","OPEN").maybeSingle();if(error)throw error;if(!trade)return reply({error:"Open paper position not found."},404,origin);
   const mid=await quoteFor(trade.symbol,url,anon,admin,true),c=costs(trade.symbol,trade.side==="BUY"?"SELL":"BUY",Number(trade.quantity),mid);
   const {data,error:closeErr}=await admin.rpc("bb_paper_close_position",{p:{user_id:user.id,paper_account_id:ledger.id,trade_id:trade.id,exit_price:c.fill,spread_cost:c.spread_cost,commission:c.commission,slippage:c.slippage,reason:String(body.reason||"MANUAL CLOSE").slice(0,100)}});if(closeErr)throw closeErr;return reply({success:true,...data,quote:mid,execution:{mode:"PAPER",broker_routing:false}},200,origin);
  }
  if(action==="modify"){
   const tradeId=String(body.trade_id||"");const {data:trade,error}=await admin.from("bb_paper_execution_trades").select("id,side,mark_price,entry_price").eq("id",tradeId).eq("paper_account_id",ledger.id).eq("status","OPEN").maybeSingle();if(error)throw error;if(!trade)return reply({error:"Open paper position not found."},404,origin);
   const sl=body.stop_loss==null||body.stop_loss===""?null:num(body.stop_loss),tp=body.take_profit==null||body.take_profit===""?null:num(body.take_profit),current=Number(trade.mark_price||trade.entry_price);
   if(sl!=null&&((trade.side==="BUY"&&sl>=current)||(trade.side==="SELL"&&sl<=current)))return reply({error:"Invalid stop loss."},400,origin);if(tp!=null&&((trade.side==="BUY"&&tp<=current)||(trade.side==="SELL"&&tp>=current)))return reply({error:"Invalid take profit."},400,origin);
   const {error:updateErr}=await admin.from("bb_paper_execution_trades").update({stop_loss:sl,take_profit:tp}).eq("id",tradeId).eq("paper_account_id",ledger.id).eq("status","OPEN");if(updateErr)throw updateErr;return reply({success:true},200,origin);
  }
  if(action==="set_balance"){
   if(mode!=="demo"||!accountId)return reply({error:"Demo account ID is required for virtual balance changes."},400,origin);
   const operation=String(body.operation||"topup").toLowerCase(),amount=Number(body.amount),note=String(body.note||"Client demo balance adjustment").trim().slice(0,240);
   if(!["set","topup"].includes(operation)||!Number.isFinite(amount)||amount<0||amount>100000000||(operation==="topup"&&amount<=0))return reply({error:"Enter a valid demo balance amount."},400,origin);
   const {data,error}=await admin.rpc("bb_paper_adjust_demo_balance",{p_actor_id:user.id,p_user_id:targetUserId,p_account_id:accountId,p_operation:operation,p_amount:amount,p_note:note});if(error)throw error;return reply(data,200,origin);
  }
  if(action==="auto_toggle"||action==="stop"){
   const enabled=action==="auto_toggle"&&body.enabled===true;const {error}=await admin.from("bb_paper_execution_accounts").update({auto_enabled:enabled,emergency_stop:action==="stop"||!enabled,updated_at:new Date().toISOString()}).eq("id",ledger.id).eq("user_id",targetUserId);if(error)throw error;return reply({success:true,auto_enabled:enabled,emergency_stop:action==="stop"},200,origin);
  }
  return reply({error:"Unsupported action."},400,origin);
 }catch(e){console.error("paper-execution:",e);return reply({error:e instanceof Error?e.message:"Paper execution error."},400,origin);}
});