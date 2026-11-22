import {numberOrNull,reservePercentLabel} from './watering-model.js?v=5';

export function plantDrydownGauge(view,confirmedSaturation){
  const observedLow=numberOrNull(view.observedLow?.weight);
  const confirmedFull=numberOrNull(confirmedSaturation);
  const observedSpan=observedLow!==null&&confirmedFull!==null&&confirmedFull>observedLow?confirmedFull-observedLow:null;
  // Keep the plotted endpoints and the displayed endpoints from the same range.
  // An initial setup range is provisional; an observed low is a comparison
  // point, not evidence that all plant-available water has been exhausted.
  const setupRange=observedSpan===null&&view.percent!==null&&view.known;
  const low=setupRange?view.dry:observedLow;
  const full=setupRange?view.wet:confirmedFull;
  const title='Dry-down'+(observedSpan!==null||setupRange?' range':'');
  const lowLabel=setupRange?'Setup reference':'Observed low';
  const fullLabel=confirmedFull!==null?'Saturated weight':'Setup full weight';
  const base={low,full,title,lowLabel,fullLabel};
  const available=view.fresh&&!view.maintenance&&!view.cycle.potRemoved;
  const position=available&&observedSpan!==null?Math.max(0,Math.min(1,(view.latest.w-observedLow)/observedSpan)):null;
  const rate=view.rate;
  const falling=rate>0;
  const late=position!==null&&position<=.12&&falling;
  const slowed=late&&view.usage.rate>0&&rate<=view.usage.rate*.5;
  const tail=view.cycle.segment.filter(p=>p.t>=view.latest?.t-6*3600000);
  const newLow=late&&tail.length>=3&&tail.slice(-3).every(p=>p.w<=low-1)&&
    tail.slice(1).every((p,i)=>Math.abs(p.w-tail[i].w)<=5);
  if(view.cycle.potRemoved)return {...base,label:'Pot off',caption:'reading paused',angle:null,late:false,slowed:false,newLow:false};
  if(!available)return {...base,label:view.maintenance?'Paused':'Offline',caption:'reading paused',angle:null,late:false,slowed:false,newLow:false};
  if(setupRange)return {...base,label:reservePercentLabel(view.percent),caption:'setup range',angle:view.angle,late,slowed,newLow};
  if(position===null){
    const weight=numberOrNull(view.latest?.w);
    return {...base,label:weight===null?'Waiting':Math.round(weight)+' g',caption:falling?'drying down':view.cycle.recent?'recently watered':'current weight',angle:null,late:false,slowed:false,newLow:false};
  }
  const label=falling?'Drying down':view.cycle.recent?'Refilled':view.referenceReached?'Check':'Tracking';
  return {...base,label,caption:late?(newLow?'new observed low':'near observed low'):'observed range',
    angle:position===null?null:225+270*position,late,slowed,newLow};
}
