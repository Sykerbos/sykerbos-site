// Actual measured extremes. These are observations, not irrigation thresholds.
export function observedRange(rows, latest=null){
  const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const weights=(rows||[]).map(r=>number(r.weight_g)).filter(v=>v!==null);
  const current=number(latest?.weight_g);
  if(current!==null) weights.push(current);
  return {low:weights.length?Math.min(...weights):null,high:weights.length?Math.max(...weights):null,current};
}
