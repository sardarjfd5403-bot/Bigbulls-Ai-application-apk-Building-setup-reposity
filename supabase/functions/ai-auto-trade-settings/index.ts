import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const ORIGINS = new Set(["https://bigbullsglobalmarket.is-an.ai","https://localhost","http://localhost","capacitor://localhost","ionic://localhost"]);
const headers = (origin:string|null) => ({"Access-Control-Allow-Origin":origin&&ORIGINS.has(origin)?origin:"https://bigbullsglobalmarket.is-an.ai","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","X-Content-Type-Options":"nosniff","Cache-Control":"no-store"});
const reply=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...headers(origin),"Content-Type":"application/json"}});
const LIVE_KEYS=["liquidity_verified","settlement_verified","regulatory_authorized","client_funds_controls_verified","reconciliation_verified"];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response("ok",{headers:headers(origin)});
 if(req.method!=="POST")return reply({error:"POST required"},405,origin);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")||"";
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!url||!anon||!service||!token)return reply({error:"Authentication or server configuration missing."},401,origin);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await auth.auth.getUser(token);
  if(authError||!authData.user)return reply({error:"Session expired. Sign in again."},401,origin);
  const user=authData.user,db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({})),accountId=String(body.account_id||"");
  if(!accountId)return reply({error:"Trading account is required."},400,origin);
  const {data:account,error:accountError}=await db.from("trading_accounts").select("id,user_id,account_mode,status,archived_at,deleted_at,currency").eq("id",accountId).eq("user_id",user.id).maybeSingle();
  if(accountError)throw accountError;
  if(!account||account.account_mode!=="real"||account.status!=="approved"||account.archived_at||account.deleted_at||String(account.currency||"USD").toUpperCase()!=="USD")return reply({error:"AI Auto-Trade is available only on your approved, active Real USD account."},403,origin);
  const [{data:platform,error:pe},{data:bbook,error:be},{data:existing,error:ee}]=await Promise.all([
   db.from("bb_execution_settings").select("ai_auto_execution_enabled,live_execution_enabled,global_halt,live_readiness,max_risk_per_trade_pct,max_daily_loss_pct").eq("singleton",true).single(),
   db.from("bb_bbook_settings").select("enabled").eq("singleton",true).single(),
   db.from("bb_ai_auto_trade_settings").select("enabled,risk_pct,reward_pct,max_daily_loss_pct").eq("user_id",user.id).eq("account_id",accountId).maybeSingle()
  ]);
  if(pe||be||ee)throw pe||be||ee;
  const missing=LIVE_KEYS.filter(k=>platform.live_readiness?.[k]!==true);
  const ready=platform.ai_auto_execution_enabled===true&&platform.live_execution_enabled===true&&platform.global_halt!==true&&bbook.enabled===true&&missing.length===0;
  const action=String(body.action||"get");
  if(action==="get")return reply({ok:true,enabled:existing?.enabled===true,ready,reason:ready?null:"AI execution is paused by platform safety/readiness controls.",risk_pct:Number(existing?.risk_pct??0.5),reward_pct:Number(existing?.reward_pct??2.5),max_daily_loss_pct:Number(existing?.max_daily_loss_pct??1.5)},200,origin);
  if(action!=="set"||typeof body.enabled!=="boolean")return reply({error:"Use action=get or action=set with enabled true/false."},400,origin);
  if(body.enabled===true){
   if(!ready)return reply({error:"AI Auto-Trade cannot start: platform execution readiness or global safety controls are not enabled."},423,origin);
   const {data:kyc,error:ke}=await db.from("kyc_submissions").select("id,status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(ke)throw ke;
   if(kyc?.status!=="approved")return reply({error:"Complete approved KYC before enabling AI Auto-Trade."},403,origin);
  }
  const maxRisk=Math.min(3,Number(platform.max_risk_per_trade_pct)||0),maxDaily=Math.min(3,Number(platform.max_daily_loss_pct)||0);
  const risk=Math.min(maxRisk,Math.max(0.1,Number(body.risk_pct)||0.5)),daily=Math.min(maxDaily,Math.max(0.5,Number(body.max_daily_loss_pct)||1.5)),reward=Math.min(3,Math.max(2,Number(body.reward_pct)||2.5));
  if(body.enabled===true&&(!(maxRisk>0)||!(maxDaily>0)))return reply({error:"Platform risk limits are not configured."},423,origin);
  const {data:saved,error:se}=await db.from("bb_ai_auto_trade_settings").upsert({user_id:user.id,account_id:accountId,enabled:body.enabled,risk_pct:risk,reward_pct:reward,max_daily_loss_pct:daily,updated_at:new Date().toISOString()},{onConflict:"user_id,account_id"}).select("enabled,risk_pct,reward_pct,max_daily_loss_pct").single();
  if(se)throw se;
  return reply({ok:true,...saved,ready,reason:body.enabled?null:"AI Auto-Trade is OFF. Manual execution remains available."},200,origin);
 }catch(e){console.error("ai-auto-trade-settings:",e);return reply({error:e instanceof Error?e.message:"Unable to update AI Auto-Trade settings."},500,origin);}
});