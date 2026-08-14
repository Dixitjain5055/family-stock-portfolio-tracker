import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { aggregateLots, summarizePortfolio } from "@/lib/portfolio/calculations";
import { getPortfolioMarketQuotes } from "@/lib/market/amfi";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAuthDisabled, requireUser } from "@/lib/supabase/auth";
import type { ExitedTrade, FamilyMember, HoldingLot, MarketQuote } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const userId="00000000-0000-4000-8000-000000000001";
const demoMembers:FamilyMember[]=[
  {id:"10000000-0000-4000-8000-000000000001",user_id:userId,name:"Ravi",default_broker:"HDFC Securities",created_at:"2025-01-01T00:00:00Z",updated_at:"2025-01-01T00:00:00Z"},
  {id:"10000000-0000-4000-8000-000000000002",user_id:userId,name:"Anita",default_broker:"Zerodha",created_at:"2025-01-01T00:00:00Z",updated_at:"2025-01-01T00:00:00Z"},
  {id:"10000000-0000-4000-8000-000000000003",user_id:userId,name:"Maya",default_broker:"Groww",created_at:"2025-01-01T00:00:00Z",updated_at:"2025-01-01T00:00:00Z"},
];
function demoLot(id:string,member:number,ticker:string,company:string,qty:number,price:number,date:string,broker:string,assetType:"stock"|"mutual_fund"="stock"):HoldingLot{return{id,member_id:demoMembers[member].id,ticker,asset_type:assetType,exchange:assetType==="mutual_fund"?"MUTUAL_FUND":"NSE",company_name:company,quantity:qty,remaining_quantity:qty,buy_price:price,adjusted_buy_price:price,buy_date:date,broker,source:"manual",status:"open",created_at:date,updated_at:date,family_members:{id:demoMembers[member].id,name:demoMembers[member].name,default_broker:broker}}}
const demoLots:HoldingLot[]=[
  demoLot("20000000-0000-4000-8000-000000000001",0,"RELIANCE.NS","Reliance Industries",100,2350,"2024-03-12","HDFC Securities"),
  demoLot("20000000-0000-4000-8000-000000000002",1,"RELIANCE.NS","Reliance Industries",50,2530,"2024-08-22","Zerodha"),
  demoLot("20000000-0000-4000-8000-000000000003",0,"TCS.NS","Tata Consultancy Services",42,3180,"2023-11-04","HDFC Securities"),
  demoLot("20000000-0000-4000-8000-000000000004",2,"HDFCBANK.NS","HDFC Bank",80,1510,"2025-01-16","Groww"),
  demoLot("20000000-0000-4000-8000-000000000005",1,"INFY.NS","Infosys",65,1425,"2024-05-09","Zerodha"),
  demoLot("20000000-0000-4000-8000-000000000006",2,"ITC.NS","ITC",210,405,"2023-09-18","Groww"),
  demoLot("20000000-0000-4000-8000-000000000007",1,"0P0001BAGJ.BO","HDFC Balanced Advantage Fund – Direct Growth",1842.731,341.24,"2024-02-12","MF Central","mutual_fund"),
];
const demoQuotes:MarketQuote[]=[
  ["RELIANCE.NS",2922,1.45,41.7,2.0e13],["TCS.NS",4015,-0.72,-29.1,1.4e13],["HDFCBANK.NS",1748,0.63,10.9,1.3e13],["INFY.NS",1882,5.7,101.4,7.8e12],["ITC.NS",476,-5.4,-27.2,5.9e12],["0P0001BAGJ.BO",425.67,0.18,0.76,0],
].map(([ticker,price,pct,change,marketCap])=>({ticker:String(ticker),price:Number(price),previousClose:Number(price)-Number(change),change:Number(change),changePercent:Number(pct),currency:"INR",marketTime:"2026-07-22T10:00:00.000Z",sector:null,marketCap:Number(marketCap),stale:true,instrumentType:String(ticker).startsWith("0P")?"MUTUALFUND":"EQUITY"}));
const demoTrades:ExitedTrade[]=[{id:"30000000-0000-4000-8000-000000000001",member_id:demoMembers[0].id,holding_id:demoLots[2].id,ticker:"TCS.NS",quantity:8,buy_price:3180,sell_price:3900,buy_date:"2023-11-04",sell_date:"2025-02-11",fees:48,realized_pl:5712,tax_tag:"Long-Term",created_at:"2025-02-11T10:00:00Z",family_members:{name:"Ravi"}}];

export default async function DashboardPage(){
  if(!isSupabaseConfigured()){const summary=summarizePortfolio(aggregateLots(demoLots,demoQuotes),demoTrades.reduce((s,t)=>s+t.realized_pl,0));return <DashboardClient members={demoMembers} allLots={demoLots} initialSummary={summary} trades={demoTrades} quotes={demoQuotes} demo/>}
  const auth = await requireUser().catch(() => null);if(!auth)redirect("/auth");const {supabase,user}=auth;
  const [{data:members,error:memberError},{data:lots,error:lotError},{data:trades,error:tradeError}]=await Promise.all([
    supabase.from("family_members").select("*").eq("user_id",user.id).order("created_at"),
    supabase.from("holdings").select("*,family_members!inner(id,name,default_broker,user_id)").eq("family_members.user_id",user.id).gt("remaining_quantity",0).order("buy_date"),
    supabase.from("exited_trades").select("*,family_members!inner(name,user_id)").eq("family_members.user_id",user.id).order("sell_date",{ascending:false}),
  ]);
  if(memberError||lotError||tradeError){
    console.error("Dashboard Supabase query failed", {
      members: memberError,
      holdings: lotError,
      trades: tradeError,
    });
    throw new Error(memberError?.message||lotError?.message||tradeError?.message);
  }
  const typedLots=(lots??[]) as unknown as HoldingLot[];const quotes=await getPortfolioMarketQuotes(typedLots);const typedTrades=(trades??[]) as unknown as ExitedTrade[];const summary=summarizePortfolio(aggregateLots(typedLots,quotes),typedTrades.reduce((s,t)=>s+Number(t.realized_pl),0));
  return <DashboardClient members={(members??[]) as FamilyMember[]} allLots={typedLots} initialSummary={summary} trades={typedTrades} quotes={quotes} showSignOut={!isAuthDisabled()}/>;
}
