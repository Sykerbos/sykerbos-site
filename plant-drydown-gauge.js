import {numberOrNull,reservePercentLabel} from './watering-model.js?v=5';

export function plantDrydownGauge(view,confirmedSaturation){
  const low=view.observedLow?.weight??null;
  const full=numberOrNull(confirmedSaturation);
  const available=view.fresh&&!view.maintenance&&!view.cycle.potRemoved;
  const span=low!==null&&full!==null&&full>low?full-low:null;
  const position=available&&span!==null?Math.max(0,Math.min(1,(view.latest.w-low)/span)):null;
  const rate=view.rate;
  const falling=rate>0;
  const late=position!==null&&position<=.12&&falling;
  const slowed=late&&view.usage.rate>0&&rate<=view.usage.rate*.5;
  const tail=view.cycle.segment.filter(p=>p.t>=view.latest?.t-6*3600000);
  const newLow=late&&tail.length>=3&&tail.slice(-3).every(p=>p.w<=low-1)&&
    tail.slice(1).every((p,i)=>Math.abs(p.w-tail[i].w)<=5);
  if(view.cycle.potRemoved)return {low,full,label:'Pot off',caption:'water reserve',angle:null,late:false,slowed:false,newLow:false};
  if(!available)return {low,full,label:view.maintenance?'Paused':'Offline',caption:'water reserve',angle:null,late:false,slowed:false,newLow:false};
  if(view.percent!==null&&position===null)return {low,full,label:reservePercentLabel(view.percent),caption:'water reserve',angle:view.angle,late,slowed,newLow};
  const label=falling?'Drying down':view.cycle.recent?'Refilled':view.referenceReached?'Check':'Tracking';
  return {low,full,label,caption:late?(newLow?'new observed low':'near observed low'):position!==null?'observed range':'water reserve',
    angle:position===null?null:225+270*position,late,slowed,newLow};
}
