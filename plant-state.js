import {irrigationState} from './irrigation-state.js?v=2';
import {observedHighUse,numberOrNull} from './watering-model.js?v=4';
export function plantState(plant,readings,{now=Date.now(),maintenance=false}={}){
  const dry=numberOrNull(plant.learned_dry_g??plant.provisional_dry_g),wet=numberOrNull(plant.learned_saturated_g??plant.provisional_saturated_g);
  const cycle=irrigationState(readings,{dry,wet,now}),latest=cycle.latest;
  const fresh=Boolean(latest&&now-latest.t>=-60000&&now-latest.t<90*60000);
  const emptyFloor=Math.max(50,dry===null?0:dry*.5);
  const run=latest?.run_id??null;
  const rows=(readings||[]).filter(r=>(r.run_id??null)===run).sort((a,b)=>Date.parse(a.measured_at||a.created_at)-Date.parse(b.measured_at||b.created_at));
  const potRows=rows.filter(r=>numberOrNull(r.weight_g)!==null&&Number(r.weight_g)>=emptyFloor);
  const recent=potRows.slice(-72).map(r=>Number(r.weight_g));
  const known=dry!==null&&wet!==null&&wet>dry;
  const reserve=known&&fresh&&!maintenance&&!cycle.potRemoved?Math.min(wet-dry,Math.max(0,latest.w-dry)):null;
  const percent=reserve===null?null:Math.max(0,Math.min(100,reserve/(wet-dry)*100));
  const usage=observedHighUse(rows,{now,dry});
  return {dry,wet,known,cycle,latest,fresh,maintenance,emptyFloor,potRows,low:recent.length?Math.min(...recent):null,high:recent.length?Math.max(...recent):null,reserve,percent,angle:percent===null?null:225+percent*2.7,usage,days:reserve!==null&&usage.rate>0?reserve/usage.rate:null,rate:fresh&&!maintenance&&!cycle.potRemoved?(cycle.twelve.rate??cycle.six.rate):null};
}
