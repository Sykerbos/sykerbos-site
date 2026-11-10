const HOUR=3600000;
const grams=n=>n.toLocaleString(undefined,{maximumFractionDigits:1,minimumFractionDigits:0})+' g';
const duration=hours=>hours<24?Math.round(hours)+' h':Number((hours/24).toFixed(1))+' d';

export function plantActivity(view,dial,cycles,readings){
  const events=[];
  const {latest,cycle}=view;
  const active=latest&&view.fresh&&!view.maintenance&&!cycle.potRemoved;
  if(active&&dial.late){
    const delta=latest.w-dial.low;
    const place=Math.abs(delta)<.1?'At the observed low':grams(Math.abs(delta))+(delta>0?' above':' below')+' the observed low';
    events.push({kind:'dry',at:latest.t,title:dial.newLow?'New observed low':'Approaching the previous cycle low',copy:`${place}. Losing ${grams(view.rate)}/day.`,live:true});
  }else if(active&&cycle.refill&&!cycle.recent&&view.rate>0){
    events.push({kind:'dry',at:latest.t,title:'Dry-down underway',copy:`${duration((latest.t-cycle.refill.at)/HOUR)} since watering · losing ${grams(view.rate)}/day.`,live:true});
  }
  if(cycle.refill){
    events.push({kind:'water',at:cycle.refill.at,title:'Watering detected',copy:`The pot gained ${grams(cycle.refill.gain)}, bringing it to ${grams(cycle.refill.after)}.`});
  }
  const previous=cycles.findLast(c=>c.completed);
  if(previous&&previous.netLoss>0){
    const low=view.observedLow?.cycleStartedAt===previous.at?view.observedLow.weight:null;
    const end=low===null?`Ended at ${grams(previous.endWeight)}`:`Reached a steady low of ${grams(low)}`;
    events.push({kind:'cycle',at:previous.lastAt,title:'Previous cycle completed',copy:`${end} after ${duration(previous.days*24)}.`});
  }
  if(latest){
    const times=readings.filter(r=>(r.run_id??null)===(latest.run_id??null))
      .map(r=>Date.parse(r.measured_at||r.created_at)).filter(t=>t>=latest.t-7*24*HOUR&&t<=latest.t).sort((a,b)=>a-b);
    const resumed=times.findLastIndex((t,i)=>i>0&&t-times[i-1]>=3*HOUR);
    if(resumed>0)events.push({kind:'signal',at:times[resumed],title:'Readings resumed',copy:`VyTile logged a new reading after a ${duration((times[resumed]-times[resumed-1])/HOUR)} gap.`});
  }
  return events.sort((a,b)=>b.at-a.at).slice(0,4);
}
