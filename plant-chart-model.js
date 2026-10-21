import {transientWeightSpikes} from './reading-quality.js?v=1';
// Keep the latest watering visible by default and retain the pot's reference scale.
const time=r=>Date.parse(r.measured_at||r.created_at);
const weight=r=>r.weight_g==null||String(r.weight_g).trim()===''?null:Number(r.weight_g);
export function plantChartModel(readings,view,{range='cycle'}={}){
  const end=view.latest?.t;
  if(!Number.isFinite(end))return {rows:[],pot:[],refill:null};
  const run=view.latest.run_id??null;
  const history=(readings||[]).filter(r=>(r.run_id??null)===run&&Number.isFinite(time(r))&&time(r)<=end&&Number.isFinite(weight(r))).sort((a,b)=>time(a)-time(b));
  const spikes=transientWeightSpikes(history,{dry:view.dry,wet:view.wet,emptyFloor:view.emptyFloor});
  const refillAt=view.cycle?.refill?.at;
  const refillIndex=history.findIndex(r=>time(r)===refillAt&&weight(r)>=view.emptyFloor&&!spikes.has(r));
  let start;
  if(range==='cycle'&&refillIndex>=0){
    // Include the preceding on-pot reading to show the rise, even across a pot lift.
    const before=history.slice(0,refillIndex).findLast(r=>weight(r)>=view.emptyFloor&&!spikes.has(r));
    start=before?time(before):refillAt;
  }else start=end-(range==='cycle'?168:Number(range))*3600000;
  const rows=history.filter(r=>time(r)>=start);
  const pot=rows.filter(r=>weight(r)>=view.emptyFloor&&!spikes.has(r));
  const values=pot.map(weight);
  // A current reading must never redefine 'full'. Keep references visible and
  // expand only for observed values outside them; do not clip over-capacity peaks.
  for(const reference of [view.dry,view.wet])if(reference!==null&&reference!==undefined&&Number.isFinite(reference))values.push(reference);
  let lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1;
  if(hi-lo<1){lo-=.5;hi+=.5;}
  return {rows,pot,spikes,excludedSpikes:rows.filter(r=>spikes.has(r)).length,lo,hi,start:rows.length?time(rows[0]):start,end,refill:rows.find(r=>time(r)===refillAt&&weight(r)>=view.emptyFloor)||null,cycleFound:refillIndex>=0,range};
}
