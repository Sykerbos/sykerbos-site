const MAX_AGE=90*60000;
const key=c=>'sykerbos:watering-weight:'+JSON.stringify([c.userId,c.plantId,c.deviceId]);
const validContext=c=>c&&[c.userId,c.plantId,c.deviceId,c.deviceCode].every(v=>typeof v==='string'&&v.length>0);
const at=r=>Date.parse(r?.measured_at||r?.created_at);
function storageOrNull(storage){
  try{return storage??globalThis.localStorage??null;}catch{return null;}
}
export function saveWateringWeight(context,{weight,measuredAt,temperature=null},{storage,now=Date.now()}={}){
  const mass=Number(weight),t=Number(measuredAt),store=storageOrNull(storage);
  if(!store||!validContext(context)||weight==null||!Number.isFinite(mass)||mass<50||!Number.isFinite(t)||t>now||now-t>=3000)return false;
  const value={...context,weight_g:mass,captured_at:t,temperature_c:temperature==null?null:Number(temperature)};
  try{store.setItem(key(context),JSON.stringify(value));return true;}catch{return false;}
}
// Return a display-only sample. Never write it into the device's cloud history.
export function wateringDisplayRows(context,readings,{storage,now=Date.now()}={}){
  const store=storageOrNull(storage);
  if(!store||!validContext(context))return readings;
  const id=key(context);
  try{
    const raw=store.getItem(id);if(!raw)return readings;
    const p=JSON.parse(raw);
    const latest=readings.reduce((a,r)=>!a||at(r)>at(a)?r:a,null);
    const mismatch=p.userId!==context.userId||p.plantId!==context.plantId||p.deviceId!==context.deviceId||p.deviceCode!==context.deviceCode;
    const invalid=!Number.isFinite(p.captured_at)||p.captured_at>now+1000||now-p.captured_at>=MAX_AGE||!Number.isFinite(p.weight_g)||p.weight_g<50;
    const replaced=latest&&(at(latest)>=p.captured_at||(latest.run_id??null)!==(p.runId??null));
    if(mismatch||invalid||replaced){store.removeItem(id);return readings;}
    return [...readings,{weight_g:p.weight_g,temperature_c:Number.isFinite(p.temperature_c)?p.temperature_c:null,
      measured_at:new Date(p.captured_at).toISOString(),run_id:p.runId??null,source:'live-watering'}];
  }catch{return readings;}
}
