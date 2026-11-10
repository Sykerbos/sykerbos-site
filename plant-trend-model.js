import {detectedRefills} from './drydown-evidence.js?v=1';
import {transientWeightSpikes} from './reading-quality.js?v=1';
const HOUR=3600000,DAY=24*HOUR;
const val=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
export function dayBoundaries(start,end){
 const date=new Date(start);date.setHours(0,0,0,0);date.setDate(date.getDate()+1);
 const dates=[];while(date.getTime()<end&&dates.length<100){dates.push(date.getTime());date.setDate(date.getDate()+1);}return dates;
}
function interpolate(points,t){
 const index=points.findIndex(p=>p.t>=t);if(index<0)return null;
 const b=points[index];if(b.t===t)return b.w;if(!index)return null;const a=points[index-1];
 if(b.t-a.t>90*60000)return null;return a.w+(b.w-a.w)*(t-a.t)/(b.t-a.t);
}
function uninterrupted(points,start,end){
 const a=interpolate(points,start),b=interpolate(points,end);if(a===null||b===null)return null;
 const window=points.filter(p=>p.t>start&&p.t<end),all=[{t:start,w:a},...window,{t:end,w:b}];
 if(all.slice(1).some((p,i)=>p.t-all[i].t>90*60000||Math.abs(p.w-all[i].w)>5))return null;
 return {first:a,last:b,loss:(a-b)/((end-start)/DAY)};
}
export function plantTrendModel(readings,view,{range='cycle'}={}){
 const end=view.latest?.t;if(!Number.isFinite(end))return {current:[],previous:[],temperature:[],forecast:[],ticks:[],cycles:[]};
 const run=view.latest.run_id??null;
 const points=(readings||[]).map(r=>({...r,t:Date.parse(r.measured_at||r.created_at),w:val(r.weight_g),temp:val(r.temperature_c)})).filter(p=>(p.run_id??null)===run&&Number.isFinite(p.t)&&p.t<=end&&p.w!==null).sort((a,b)=>a.t-b.t);
 const spikes=transientWeightSpikes(points,{dry:view.dry,wet:view.wet,emptyFloor:view.emptyFloor});
 const clean=points.filter(p=>p.w>=view.emptyFloor&&!spikes.has(p));
 const refills=detectedRefills(clean,view.dry,view.wet);
 const cycles=refills.map((refill,index)=>{
  const next=refills[index+1]||null;
  const samples=clean.filter(p=>p.t>=refill.t&&(!next||p.t<next.t));
  const raw=points.filter(p=>p.t>=refill.t&&(!next||p.t<next.t));
  const lastSample=samples.at(-1)||refill;
  const before=clean[clean.indexOf(refill)-1];
  const gapHours=raw.slice(1).reduce((max,p,i)=>Math.max(max,(p.t-raw[i].t)/HOUR),0);
  return {at:refill.t,endedAt:next?.t??null,lastAt:lastSample.t,completed:Boolean(next),startWeight:refill.w,endWeight:lastSample.w,weightGain:before?refill.w-before.w:null,netLoss:refill.w-lastSample.w,days:((next?.t??lastSample.t)-refill.t)/DAY,readings:samples.length,gapHours:gapHours>1.5?gapHours:null,handling:raw.some(p=>p.w<view.emptyFloor||spikes.has(p))};
 });
 const last=refills.find(p=>p.t===view.cycle.refill?.at)||null;
 const lastIndex=last?refills.indexOf(last):-1,previousRefill=lastIndex>0?refills[lastIndex-1]:null;
 let start=range==='cycle'?(previousRefill?.t??last?.t??end-7*DAY):end-Number(range)*HOUR;
 // Preserve one pre-watering pot reading so the rise remains visible.
 if(range==='cycle'&&(previousRefill||last)){const first=previousRefill||last,before=clean.findLast(p=>p.t<first.t);if(before&&first.t-before.t<=90*60000)start=before.t;}
 const past=points.filter(p=>p.t>=start),pot=clean.filter(p=>p.t>=start);
 const previous=last?past.filter(p=>p.t<=last.t):[];
 const current=last?past.filter(p=>p.t>=last.t):past;
 const previousClean=previousRefill&&last?clean.filter(p=>p.t>=previousRefill.t&&p.t<last.t):[];
 const currentClean=last?clean.filter(p=>p.t>=last.t):clean;
 // A projection requires a fresh, uninterrupted measured day. Temperature is
 // displayed as context, not applied as a water-use multiplier without humidity.
 const recent=uninterrupted(view.cycle.segment,end-DAY,end);
 let forecast=[],method=null;
 if(range==='cycle'&&view.fresh&&!view.maintenance&&!view.cycle.potRemoved&&recent?.loss>0){
  const elapsed=last?end-last.t:null;
  const historicalNow=previousRefill&&elapsed!==null?previousRefill.t+elapsed:null;
  const comparable=historicalNow!==null?uninterrupted(previousClean,historicalNow-DAY,historicalNow):null;
  const ratio=comparable?.loss>0.5?recent.loss/comparable.loss:null;
  const matched=ratio!==null&&ratio>=.5&&ratio<=2;
  forecast=[{t:end,w:view.latest.w}];method='recent-trend';
  for(let h=6;h<=72;h+=6){
   const delta=h*HOUR;
   const pattern=matched?uninterrupted(previousClean,historicalNow,historicalNow+delta):null;
   const loss=pattern&&pattern.loss>0?(pattern.first-pattern.last)*ratio:recent.loss*delta/DAY;
   if(pattern&&pattern.loss>0)method='cycle-adjusted';
   forecast.push({t:end+delta,w:Math.max(0,view.latest.w-loss)});
  }
  // Avoid an artificial rise where a partially available historical pattern
  // hands over to the recent trend at the end of the earlier cycle.
  for(let i=1;i<forecast.length;i++)forecast[i].w=Math.min(forecast[i].w,forecast[i-1].w);
 }
 const temperature=past.filter(p=>p.temp!==null&&p.temp>=-55&&p.temp<85);
 const temperatures=temperature.map(p=>p.temp);
 let tempLo=temperatures.length?Math.floor(Math.min(...temperatures)-.5):0,tempHi=temperatures.length?Math.ceil(Math.max(...temperatures)+.5):1;
 if(tempHi-tempLo<6){const mid=(tempHi+tempLo)/2;tempLo=Math.floor(mid-3);tempHi=tempLo+6;}
 const weights=[...pot.map(p=>p.w),...forecast.map(p=>p.w)];
 for(const reference of [view.dry,view.wet])if(reference!==null&&Number.isFinite(reference))weights.push(reference);
 let lo=weights.length?Math.floor(Math.min(...weights)):0,hi=weights.length?Math.ceil(Math.max(...weights)):1;if(hi-lo<1)hi=lo+1;
 const plotEnd=forecast.at(-1)?.t??end;
 return {current,previous,temperature,forecast,spikes,cycles,emptyFloor:view.emptyFloor,lo,hi,tempLo,tempHi,start:past[0]?.t??start,end,plotEnd,refill:last,previousRefill,method,potCount:pot.length,ticks:dayBoundaries(past[0]?.t??start,plotEnd)};
}
