export function collectionDemo(scenario=null){
 const now=Date.now();
 return [{id:'demo-a',nickname:'Pot A',wet:640,end:575.3},{id:'demo-b',nickname:'Pot B',wet:629,end:548.8}].map((p,index)=>{
  const history=Array.from({length:1585},(_,i)=>{const since=i-1224;return {weight_g:i<288?550-i*.06:i<1224?p.wet-(i-288)*.12:p.wet-(p.wet-p.end)*since/360,temperature_c:21.2,measured_at:new Date(now-(1584-i)*1200000).toISOString(),run_id:'DEMO-COLLECTION'};});
  if(index===1&&scenario==='below-reference')history.slice(1224).forEach((r,i)=>{const remaining=1-i/360;r.weight_g=519.6+19*remaining+90.4*remaining**2;});
  if(index===1&&scenario==='offline')history.forEach(r=>r.measured_at=new Date(Date.parse(r.measured_at)-6*3600000).toISOString());
  if(index===1&&scenario==='removed')history.at(-1).weight_g=0;
  return {id:p.id,nickname:p.nickname,common_name:'Valencia Orange Seedling',learned_saturated_g:scenario==='learning'&&index===1?null:p.wet,provisional_dry_g:525,display_order:index,device:{id:p.id,device_code:index?'Mini02':'Mini01'},history};
 });
}
