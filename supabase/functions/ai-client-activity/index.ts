import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const ALLOWED=new Set(["https://bigbullsglobalmarket.is-an.ai","https://localhost","http://localhost","capacitor://localhost","ionic://localhost"]);
const headers=(origin:string|null)=>({"Access-Control-Allow-Origin":origin&&ALLOWED.has(origin)?origin:"https://bigbullsglobalmarket.is-an.ai","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...headers(origin),"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response("ok",{headers:headers(origin)});
 if(req.method!=="POST")return json({error:"POST required"},405,origin);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")||"";
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!url||!anon||!service||!token)return json({error:"Authentication or server configuration missing."},401,origin);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await auth.auth.getUser(token);
  if(authError||!authData.user)return json({error:"Session expired. Sign in again."},401,origin);
  const user=authData.user,body=await req.json().catch(()=>({})),accountId=String(body.account_id||"");
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  let query=db.from("bb_ai_auto_trade_execution_log").select("id,account_id,symbol,direction,status,reason,quantity,risk_amount,created_at,updated_at,quote_bid,quote_ask").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40);
  if(accountId){
   const {data:account,error:accountError}=await db.from("trading_accounts").select("id,user_id,account_mode,status,archived_at,deleted_at").eq("id",accountId).eq("user_id",user.id).maybeSingle();
   if(accountError)throw accountError;
   if(!account||account.account_mode!=="real"||account.status!=="approved"||account.archived_at||account.deleted_at)return json({error:"Select your active approved Real account."},403,origin);
   query=query.eq("account_id",accountId);
  }
  const {data,error}=await query;
  if(error)throw error;
  return json({ok:true,activity:data||[],generated_at:new Date().toISOString()},200,origin);
 }catch(error){
  console.error("ai-client-activity:",error);
  return json({error:error instanceof Error?error.message:"AI activity is unavailable."},500,origin);
 }
});