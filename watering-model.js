export const numberOrNull=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
export function waterPlan({current,addition,dry,wet,rate}){
  const mass=numberOrNull(current),add=numberOrNull(addition),lo=numberOrNull(dry),hi=numberOrNull(wet),loss=numberOrNull(rate);
  const target=mass!==null&&add!==null&&add>=0?mass+add:null;
  const capacity=mass!==null&&hi!==null&&hi>0?Math.max(0,hi-mass):null;
  const overWet=target!==null&&hi!==null?Math.max(0,target-hi):0;
  const valid=lo!==null&&hi!==null&&hi>lo;
  const permitted=capacity!==null&&add!==null&&add>0&&add<=capacity+1e-7;
  const reserve=target!==null&&valid&&overWet<=1e-7?Math.max(0,target-lo):null;
  return {target,suggested:capacity,overWet,permitted,reserve,days:reserve!==null&&loss!==null&&loss>0?reserve/loss:null};
}
// Completed UTC days in the current measurement run only. This is a planning
// estimate of measured weight loss (including evaporation), not plant uptake.
export function observedHighUse(readings,{now=Date.now(),dry=null}={}){
  const dayMs=86400000,groups=new Map();
  for(const r of readings||[]){
    const t=Date.parse(r.measured_at||r.created_at),w=numberOrNull(r.weight_g);
    if(!Number.isFinite(t)||w===null||w<=0||t>now||t<now-30*dayMs)continue;
    const day=Math.floor(t/dayMs);
    if((day+1)*dayMs>now)continue;
    if(!groups.has(day))groups.set(day,[]);
    groups.get(day).push({t,w});
  }
  const eligible=[];
  for(const [day,points] of groups){
    points.sort((a,b)=>a.t-b.t);
    const pts=points.filter((p,i)=>!i||p.t!==points[i-1].t);
    if(pts.length<24)continue;
    const first=pts[0],last=pts.at(-1),span=(last.t-first.t)/dayMs;
    if(span<22/24||first.t-day*dayMs>3600000||(day+1)*dayMs-last.t>3600000)continue;
    if(dry!==null&&pts.some(p=>p.w<=dry))continue;
    const deltas=pts.slice(1).map((p,i)=>pts[i].w-p.w);
    const sorted=deltas.map(Math.abs).sort((a,b)=>a-b);
    const median=sorted[Math.floor(sorted.length/2)];
    // Reject interrupted, watered or abruptly shifted days. Small scale noise
    // is allowed, but a large step is not interpreted as daily water use.
    if(pts.slice(1).some((p,i)=>p.t-pts[i].t>5400000)||deltas.some(d=>d < -2||d>Math.max(5,median*8)))continue;
    const loss=(first.w-last.w)/span;
    if(loss>0)eligible.push({day:new Date(day*dayMs).toISOString().slice(0,10),loss});
  }
  if(eligible.length<3)return {rate:null,qualifyingDays:eligible.length,usedDays:0,days:eligible};
  const high=[...eligible].sort((a,b)=>b.loss-a.loss).slice(0,Math.ceil(eligible.length/2));
  return {rate:high.reduce((sum,d)=>sum+d.loss,0)/high.length,qualifyingDays:eligible.length,usedDays:high.length,days:eligible};
}
export function localReadingUrl(value){
  const url=new URL(value);
  const h=url.hostname.toLowerCase();
  const ip=h.split('.').map(Number);
  const privateIP=/^\d+\.\d+\.\d+\.\d+$/.test(h)&&ip.every(n=>n>=0&&n<=255)&&(ip[0]===10||ip[0]===192&&ip[1]===168||ip[0]===172&&ip[1]>=16&&ip[1]<=31);
  if(!['http:','https:'].includes(url.protocol)||(!privateIP&&!h.endsWith('.local'))||url.username||url.password||url.hash)throw Error('Enter the live-reading URL for your VyTile on your local Wi-Fi network.');
  return url;
}
export function directSample(payload,expectedCode,lastSequence=-1){
  const weight=numberOrNull(payload?.weight_g),age=numberOrNull(payload?.sample_age_ms),sequence=numberOrNull(payload?.sample_seq);
  if(payload?.device_code!==expectedCode)throw Error('This reading belongs to a different VyTile.');
  if(weight===null||age===null||age<0||age>2000||!Number.isSafeInteger(sequence)||sequence<0)throw Error('The device did not return a fresh, valid live sample.');
  if(sequence<=lastSequence)throw Error('The device has not supplied a new sample yet.');
  return {weight,sequence};
}
