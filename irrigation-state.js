// Inferred events only: do not count these as validated irrigation cycles.
const value=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
const time=r=>Date.parse(r.measured_at||r.created_at);
export function irrigationState(readings,{dry=null,wet=null,now=Date.now()}={}){
  const points=(readings||[]).map(r=>({...r,t:time(r),w:value(r.weight_g)}))
    .filter(r=>Number.isFinite(r.t)&&r.w!==null&&r.t<=now+60000).sort((a,b)=>a.t-b.t);
  const run=points.at(-1)?.run_id??null;
  const pts=points.filter((r,i)=>((r.run_id??null)===run)&&(!i||r.t!==points[i-1].t));
  const lo=value(dry),hi=value(wet),capacity=lo!==null&&hi!==null&&hi>lo?hi-lo:null;
  const empty=Math.max(50,lo===null?0:lo*.5),jump=Math.max(10,(capacity||100)*.15);
  let previous=null,segment=[],refill=null,interrupted=false;
  for(const p of pts){
    if(p.w<empty){segment=[];interrupted=true;continue;}
    if(previous){
      const gap=p.t-previous.t,change=p.w-previous.w;
      if(gap>90*60000){segment=[];interrupted=true;}
      else if(change>=jump){
        segment=[];interrupted=true;
        if(hi!==null&&p.w>=hi-Math.max(5,(capacity||100)*.25)){
          refill={at:p.t,before:previous.w,after:p.w,gain:change};
        }
      }else if(change<=-jump){segment=[];interrupted=true;}
    }
    segment.push(p);previous=p;
  }
  const latest=pts.at(-1),age=refill?now-refill.at:Infinity;
  const recent=Boolean(refill&&age>=0&&age<=12*3600000);
  function rateFor(hours){
    if(!segment.length)return {rate:null,reason:'handling'};
    const end=segment.at(-1).t,window=segment.filter(p=>p.t>=end-hours*3600000);
    if(window.length<3||(window.at(-1).t-window[0].t)<(hours-.5)*3600000)return {rate:null,reason:recent?'refill':interrupted?'handling':'coverage'};
    const mx=window.reduce((s,p)=>s+p.t/1000,0)/window.length,my=window.reduce((s,p)=>s+p.w,0)/window.length;
    const denominator=window.reduce((s,p)=>s+(p.t/1000-mx)**2,0);
    const slope=denominator?window.reduce((s,p)=>s+(p.t/1000-mx)*(p.w-my),0)/denominator*86400:null;
    return slope===null?{rate:null,reason:'coverage'}:slope>0?{rate:null,reason:'settling'}:{rate:-slope,reason:null};
  }
  return {refill,recent,settling:recent&&age<2*3600000,latest,segment,six:rateFor(6),twelve:rateFor(12)};
}
