const HOUR=3600000;
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
