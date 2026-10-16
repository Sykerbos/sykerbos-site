// Display a pot's position between its own weight references, not soil moisture.
const numeric=value=>value==null||String(value).trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
export function reserveState({weight,dry,wet,fresh=true,learning=false,provisional=false,maintenance=false}={}){
  if(maintenance||!fresh) return {kind:'offline',label:maintenance?'Maintenance':'Offline',percent:null,action:'Check the VyTile connection.',note:'No current water estimate'};
  const mass=numeric(weight),lo=numeric(dry),hi=numeric(wet);
  if(learning||mass===null||lo===null||hi===null||hi<=lo) return {kind:'learning',label:'Learning',percent:null,action:'Keep observing its watering cycles.',note:'Establishing this pot’s references'};
  const percent=Math.round(Math.max(0,Math.min(100,(mass-lo)/(hi-lo)*100)));
  const low=percent<=20;
  return {kind:low?'low':percent<=40?'drying':'comfortable',label:low?'Low reserve':percent<=40?'Drying down':'Comfortable',percent,action:low?'Check your plant before watering.':'Follow its normal dry-down.',note:provisional?'Experimental weight references':'Estimated from weight references'};
}
export function reserveMarkup(state,{sample=false}={}){
  const known=state.percent!==null;
  const centre=known?'~'+state.percent+'%':state.kind==='learning'?'…':'—';
  const description=known?`Estimated water reserve ${state.percent} percent`:`Water reserve ${state.label.toLowerCase()}`;
  return `<div class="reserve-summary reserve-${state.kind}"><div class="reserve-ring" style="--reserve-angle:${known?state.percent*3.6:0}deg" role="img" aria-label="${description}${sample?', simulated example':''}"><span>${centre}</span></div><div class="reserve-copy"><strong>${state.label}</strong><span>Water reserve${sample?' · sample':''}</span><small>${state.note}</small></div></div>`;
}
