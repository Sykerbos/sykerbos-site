import {transientWeightSpikes} from './reading-quality.js?v=1';
import {irrigationState} from './irrigation-state.js?v=3';
import {observedHighUse,numberOrNull,referenceReserve} from './watering-model.js?v=5';
import {previousDrydownLow} from './drydown-evidence.js?v=1';
export function plantState(plant,readings,{now=Date.now(),maintenance=false}={}){
  const dry=numberOrNull(plant.learned_dry_g??plant.provisional_dry_g),wet=numberOrNull(plant.learned_saturated_g??plant.provisional_saturated_g);
  const cycle=irrigationState(readings,{dry,wet,now}),latest=cycle.latest;
  const fresh=Boolean(latest&&now-latest.t>=-60000&&now-latest.t<90*60000);
  const emptyFloor=Math.max(50,dry===null?0:dry*.5);
  const run=latest?.run_id??null;
  const rows=(readings||[]).filter(r=>(r.run_id??null)===run).sort((a,b)=>Date.parse(a.measured_at||a.created_at)-Date.parse(b.measured_at||b.created_at));
  const spikes=transientWeightSpikes(rows,{dry,wet,emptyFloor});
  const potRows=rows.filter(r=>numberOrNull(r.weight_g)!==null&&Number(r.weight_g)>=emptyFloor&&!spikes.has(r));
  const recent=potRows.slice(-72).map(r=>Number(r.weight_g));
  const known=dry!==null&&wet!==null&&wet>dry;
  const available=fresh&&!maintenance&&!cycle.potRemoved;
  const {reserve,referenceReached}=referenceReserve(available?latest.w:null,dry,wet);
  let previousLow=null;
  if(referenceReached&&cycle.refill){
    const points=rows.map(r=>({...r,t:Date.parse(r.measured_at||r.created_at),w:numberOrNull(r.weight_g)})).filter(p=>Number.isFinite(p.t)&&p.t<=latest.t&&p.w!==null);
    const excluded=transientWeightSpikes(points,{dry,wet,emptyFloor});
    previousLow=previousDrydownLow(points,{dry,wet,emptyFloor,refillAt:cycle.refill.at,spikes:excluded});
  }
  const abovePreviousLow=previousLow?latest.w-previousLow.weight:null;
  const percent=reserve===null?null:Math.max(0,Math.min(100,reserve/(wet-dry)*100));
  const usage=observedHighUse(rows,{now,dry});
  const state=maintenance?'maintenance':cycle.potRemoved?'removed':!fresh?'stale':referenceReached?'reference':percent!==null&&percent<=20?'low':cycle.recent?'refill':'drying';
  return {state,dry,wet,known,referenceReached,previousLow,abovePreviousLow,cycle,latest,fresh,maintenance,emptyFloor,potRows,low:recent.length?Math.min(...recent):null,high:recent.length?Math.max(...recent):null,reserve,percent,angle:percent===null?null:225+percent*2.7,usage,days:reserve!==null&&usage.rate>0?reserve/usage.rate:null,rate:fresh&&!maintenance&&!cycle.potRemoved?(cycle.twelve.rate??cycle.six.rate):null};
}
