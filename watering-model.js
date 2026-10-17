export const numberOrNull=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
export function waterPlan({current,addition,dry,wet,rate}){
  const mass=numberOrNull(current),add=numberOrNull(addition),lo=numberOrNull(dry),hi=numberOrNull(wet),loss=numberOrNull(rate);
  const target=mass!==null&&add!==null&&add>=0?mass+add:null;
  const valid=lo!==null&&hi!==null&&hi>lo;
  const retainedTarget=target!==null&&valid?Math.min(target,hi):null;
  return {target,suggested:mass!==null&&valid?Math.max(0,hi-mass):null,overWet:target!==null&&valid?Math.max(0,target-hi):0,reserve:retainedTarget!==null?Math.max(0,retainedTarget-lo):null,days:retainedTarget!==null&&loss!==null&&loss>0?Math.max(0,retainedTarget-lo)/loss:null};
}
export function recentLossRate(rows){
  const values=(rows||[]).map(r=>({t:Date.parse(r.measured_at||r.created_at),w:numberOrNull(r.weight_g)})).filter(r=>Number.isFinite(r.t)&&r.w!==null).sort((a,b)=>a.t-b.t);
  if(!values.length)return null;
  const end=values.at(-1).t;
  let pts=values.filter(r=>r.t>=end-12*3600000);
  // Do not fit across a clear watering or handling jump.
  let start=0;for(let i=1;i<pts.length;i++)if(Math.abs(pts[i].w-pts[i-1].w)>5)start=i;
  pts=pts.slice(start);
  if(pts.length<6||pts.at(-1).t-pts[0].t<6*3600000)return null;
  const origin=pts[0].t;
  const meanT=pts.reduce((n,p)=>n+(p.t-origin)/86400000,0)/pts.length,meanW=pts.reduce((n,p)=>n+p.w,0)/pts.length;
  const num=pts.reduce((n,p)=>n+((p.t-origin)/86400000-meanT)*(p.w-meanW),0),den=pts.reduce((n,p)=>n+((p.t-origin)/86400000-meanT)**2,0);
  const loss=den?-num/den:null;
  return loss!==null&&loss>0?loss:null;
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
