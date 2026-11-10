const HOUR=3600000;
// A setup weight stops being useful after a sustained, uninterrupted decline
// carries the pot below it. A pot lift or isolated low reading cannot retire it.
export function crossedSetupWeight(points,{dry,emptyFloor,spikes}){
 let start=0,below=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],previous=points[i-1];
  if(p.w<emptyFloor||spikes.has(p)){start=i+1;below=0;continue;}
  if(previous&&(p.t-previous.t>90*60000||Math.abs(p.w-previous.w)>5)){start=i;below=0;}
  if(p.t===previous?.t)continue;
  while(start<i&&p.t-points[start+1].t>=6*HOUR)start++;
  below=p.w<=dry-.5?below+1:0;
  if(below>=3&&i-start>=4&&p.t-points[start].t>=6*HOUR&&points[start].w-p.w>=1)return true;
 }
 return false;
}
export function detectedRefills(points,dry,wet){
 const capacity=wet!==null&&dry!==null&&wet>dry?wet-dry:100;
 const jump=Math.max(10,capacity*.15),refills=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(b.t>a.t&&b.t-a.t<=90*60000&&b.w-a.w>=jump&&wet!==null&&b.w>=wet-Math.max(5,capacity*.25))refills.push(b);
 }
 return refills;
}
// Use a steady end-of-cycle weight, not the single lowest sample. This is
// an observed comparison point, not a new dry reference or water capacity.
export function previousDrydownLow(points,{dry,wet,emptyFloor,refillAt,spikes}){
 const clean=points.filter(p=>p.w>=emptyFloor&&!spikes.has(p));
 const refills=detectedRefills(clean,dry,wet),index=refills.findIndex(p=>p.t===refillAt);
 if(index<1)return null;
 const previous=refills[index-1],last=clean.findLast(p=>p.t<refillAt);
 if(!last||refillAt-last.t>90*60000||last.t-previous.t<24*HOUR)return null;
 const window=points.filter(p=>p.t>=last.t-24*HOUR&&p.t<refillAt);
 if(window.length<12||last.t-window[0].t<22*HOUR||window.some(p=>p.w<emptyFloor||spikes.has(p)))return null;
 if(window.slice(1).some((p,i)=>p.t-window[i].t>90*60000||Math.abs(p.w-window[i].w)>5))return null;
 const tail=window.filter(p=>p.t>=last.t-HOUR).map(p=>p.w).sort((a,b)=>a-b);
 if(tail.length<3||tail.at(-1)-tail[0]>2)return null;
 const mid=Math.floor(tail.length/2),weight=tail.length%2?tail[mid]:(tail[mid-1]+tail[mid])/2;
 return {weight,at:last.t,cycleStartedAt:previous.t};
}
