import {supabase} from './supabase-client.js';
import {plantAssetFor} from './plant-assets.js';
import {plantState} from './plant-state.js?v=2';

const $=s=>document.querySelector(s);
const fmt=(n,d=1)=>n!==null&&n!==undefined&&Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const stamp=r=>r?.measured_at||r?.created_at;
const time=r=>Date.parse(stamp(r));
const name=p=>p.nickname||p.common_name||'Your plant';
let plant=null,device=null,rows=[],count=0,rangeHours=24,latestKey='',loading=false;
const demo=new URLSearchParams(location.search).get('demo')==='watering';
function age(t){
  if(!Number.isFinite(t))return 'No reading';
  const minutes=Math.max(0,Math.round((Date.now()-t)/60000));
  return minutes<2?'just now':minutes<60?minutes+' min ago':Math.round(minutes/60)+' h ago';
}
function setAsset(el,asset){if(asset){el.style.backgroundImage=`url("${asset.image}")`;el.classList.add('has-image');}}
const tabs=[...document.querySelectorAll('.plant-tabs button')];
tabs.forEach(button=>button.addEventListener('click',()=>{
  tabs.forEach(b=>b.classList.toggle('active',b===button));
  document.querySelectorAll('.plant-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===button.dataset.tab));
  history.replaceState(null,'',location.pathname+location.search+'#'+button.dataset.tab);
}));
const requested=tabs.find(b=>b.dataset.tab===location.hash.slice(1));if(requested)requested.click();
document.querySelectorAll('.range-pills button').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.range-pills button').forEach(b=>b.classList.toggle('active',b===button));
  rangeHours={'24h':24,'7d':168,'30d':720}[button.textContent.trim()]||24;render();
}));
function chart(view){
  const latestTime=view.latest?.t||Date.now(),cutoff=latestTime-rangeHours*3600000;
  const visible=rows.filter(r=>time(r)>=cutoff&&time(r)<=latestTime).sort((a,b)=>time(a)-time(b));
  const pot=visible.filter(r=>Number(r.weight_g)>=view.emptyFloor);
  if(pot.length<2){$('#plant-chart').innerHTML='<div class="chart-loading">More pot readings are needed for this range.</div>';return;}
  const weights=pot.map(r=>Number(r.weight_g)),lo=Math.min(...weights),hi=Math.max(...weights),span=Math.max(1,time(visible.at(-1))-time(visible[0]));
  const point=r=>[28+(time(r)-time(visible[0]))/span*844,28+(hi-Number(r.weight_g))/Math.max(1,hi-lo)*244];
  let path='',gap=true;
  for(const r of visible){if(Number(r.weight_g)<view.emptyFloor){gap=true;continue;}const [x,y]=point(r);path+=(gap?'M':'L')+x.toFixed(1)+','+y.toFixed(1)+' ';gap=false;}
  let marker='';
  const event=visible.find(r=>time(r)===view.cycle.refill?.at);
  if(event){const [x,y]=point(event);marker=`<line x1="${x}" y1="28" x2="${x}" y2="272" stroke="#b63969" stroke-dasharray="5 5"/><circle cx="${x}" cy="${y}" r="5" fill="#b63969"/><text x="${Math.min(810,Math.max(35,x-45))}" y="44" fill="#753a51" font-size="14">Refill</text>`;}
  $('#plant-chart').innerHTML=`<svg viewBox="0 0 900 300" role="img" aria-label="Pot weight history; empty-tile readings omitted"><path d="${path}" class="plant-live-line"/>${marker}</svg><span class="plant-y top">${fmt(hi,0)} g</span><span class="plant-y bottom">${fmt(lo,0)} g</span>`;
  $('#plant-chart-note').textContent=`${pot.length} pot readings · ${rangeHours<48?'24 hours':rangeHours/24+' days'} · empty-tile readings omitted`;
}
function eventList(view){
  const host=$('#event-list');host.replaceChildren();
  const events=[];
  if(view.cycle.refill)events.push({title:'Refill detected',copy:new Date(view.cycle.refill.at).toLocaleString()+' · inferred from the weight change'});
  for(const r of rows.slice(-3).reverse())events.push({title:Number(r.weight_g)<view.emptyFloor?'Empty tile / handling':fmt(r.weight_g)+' g · '+fmt(r.temperature_c)+' °C',copy:new Date(time(r)).toLocaleString()});
  for(const event of events.slice(0,4)){
    const article=document.createElement('article'),icon=document.createElement('span'),body=document.createElement('div'),title=document.createElement('strong'),copy=document.createElement('small');
    icon.className='event-icon';icon.textContent='·';title.textContent=event.title;copy.textContent=event.copy;body.append(title,copy);article.append(icon,body);host.append(article);
  }
}
function render(){
  if(!plant)return;
  const maintenance=plant.status==='offline'||device?.status==='maintenance';
  const view=plantState(plant,rows,{maintenance}),cycle=view.cycle;
  $('#plant-status').textContent=maintenance?'Maintenance':view.fresh?'Connected':'Last seen '+age(view.latest?.t);
  $('#plant-status').className='status '+(maintenance?'offline':view.fresh?'good':'learning');
  $('#plant-weight').textContent=view.latest?fmt(view.latest.w)+' g':'—';
  $('#plant-temperature').textContent=view.latest?fmt(view.latest.temperature_c)+' °C':'—';
  $('#plant-reading-count').textContent=count.toLocaleString();
  const summaries={maintenance:'This tile is in maintenance. Historical readings remain available.',removed:'The pot appears removed. Reserve estimates are paused.',stale:'Waiting for a fresh tile reading.',low:'Reserve is low against this pot’s current references. Check the plant before watering.',refill:'Recently watered. Watching the pot settle and begin its next dry-down.',drying:'Following this pot’s measured weight and dry-down.'};
  $('#plant-summary').textContent=summaries[view.state];

  const gauge=$('#radial-gauge');
  gauge.dataset.known=String(view.percent!==null);
  gauge.style.setProperty('--angle',(view.angle??225)+'deg');
  gauge.setAttribute('role','img');gauge.setAttribute('aria-label',view.percent===null?'Water reserve unavailable':`Estimated water reserve ${Math.round(view.percent)} percent; dry to full`);
  $('#range-percent').textContent=cycle.potRemoved?'Pot off':view.percent===null?'Learning':Math.round(view.percent)+'%';
  $('#range-percent').classList.toggle('learning-reserve',view.percent===null);
  $('#range-low-side').textContent=fmt(view.low)+' g';$('#range-high-side').textContent=fmt(view.high)+' g';
  $('#range-explanation').textContent=cycle.potRemoved?'Return the pot to resume reserve estimates.':!view.fresh?'Waiting for a fresh reading.':view.known?`Dry ${fmt(view.dry,0)} g (${plant.learned_dry_g!=null?'saved':'experimental'}) · full ${fmt(view.wet,0)} g (${plant.learned_saturated_g!=null?'saved':'experimental'}). Estimated from weight, not a soil-moisture measurement.`:'Confirm this pot’s dry and saturated references to estimate reserve.';

  $('#plant-current-rate').textContent=view.rate===null?'Learning':fmt(view.rate)+' g/day';
  $('#plant-current-rate-note').textContent=view.rate!==null?'Measured since the latest watering / handling change':cycle.recent?'Rebuilding after watering':'Waiting for an uninterrupted dry-down';
  const segment=cycle.segment;
  const movement=segment.length>1?segment.at(-1).w-segment[0].w:null;
  $('#plant-recent-movement').textContent=movement===null?'—':(movement>0?'+':'')+fmt(movement)+' g';
  $('#plant-recent-movement-note').textContent='Since the latest refill / handling change';
  $('#plant-projected-days').textContent=view.days===null?'Learning':'~'+fmt(view.days)+' days';
  $('#plant-projected-note').textContent=view.days===null?'Waiting for reliable daily use and references':`${fmt(view.reserve)} g reserve · ${fmt(view.usage.rate)} g/day${view.usage.qualifyingDays<7?' · early estimate':''}`;
  $('#plant-action-title').textContent={maintenance:'Tile in maintenance.',removed:'Return the pot.',stale:'Waiting for a reading.',low:'Check your plant.',refill:'Recently watered.',drying:'Follow the dry-down.'}[view.state];
  $('#plant-action-copy').textContent={maintenance:'Historical readings remain available while the tile is in maintenance.',removed:'Return the pot to resume water reserve and dry-down readings.',stale:'Reconnect the tile before relying on its current reserve estimate.',low:'Reserve is low against the current references. Check the plant before watering, even if a recent refill was detected.',refill:'Let excess water drain. The new dry-down rate appears once enough uninterrupted readings arrive.',drying:'Use the measured trend alongside your plant’s condition. Reserve days are estimates.'}[view.state];

  $('#plant-intelligence-title').textContent='Learning '+name(plant)+'.';
  $('#plant-intelligence-copy').textContent=`${count.toLocaleString()} readings in ${view.latest?.run_id||'this measurement run'}. Irrigation and handling changes are excluded from daily-use rates.`;
  $('#plant-learning-bar').style.width=Math.min(100,Math.round(segment.length/36*100))+'%';
  $('#plant-learning-note').textContent=segment.length+' reading'+(segment.length===1?'':'s')+' in the current uninterrupted dry-down';
  $('#high-use-rate').textContent=view.usage.rate===null?'Learning':fmt(view.usage.rate);
  $('#high-use-days').textContent=String(view.usage.qualifyingDays);
  $('#new-cycle-readings').textContent=String(segment.length);
  $('#use-evidence').textContent=view.usage.qualifyingDays<7?'Early evidence':'Measured';
  $('#use-method-note').textContent=view.usage.rate===null?'At least 3 reliable full days are needed. No fixed species rate is assumed.':`g/day · average of the higher-use ${view.usage.usedDays} of ${view.usage.qualifyingDays} reliable days in this run. Weight loss includes evaporation.`;
  $('#intelligence-current-rate').textContent=view.rate===null?'Learning':fmt(view.rate)+' g/day';
  const cycles=Math.max(0,Number(plant.cycles_observed)||0);
  $('#confidence-title').textContent=cycles?'Recorded cycle evidence':'No recorded cycles yet';$('#confidence-number').textContent=String(cycles);
  $('#confidence-track-bar').style.width=Math.min(100,cycles/8*100)+'%';
  $('#confidence-copy').textContent='Recorded cycle count, not a percentage confidence or accuracy score. Detected refills do not automatically count as validated cycles.';
  $('#evidence-cycles').textContent=cycles+' recorded cycles';
  $('#evidence-slope').textContent=view.rate===null?'Dry-down rebuilding':fmt(view.rate)+' g/day measured';
  $('#evidence-reserve').textContent=view.known?`${plant.learned_saturated_g!=null?'Saved':'Experimental'} full weight · ${plant.learned_dry_g!=null?'saved':'experimental'} dry reference`:'References still needed';
  $('#evidence-next').textContent='Observe the next uninterrupted dry-down';
  $('#intel-wet').textContent=fmt(view.wet,0)+' g';$('#intel-dry').textContent=fmt(view.dry,0)+' g';$('#intel-current').textContent=fmt(view.latest?.w)+' g';
  const trigger=view.known&&view.usage.rate>0?Math.min(view.wet,view.dry+view.usage.rate*3):null;
  $('#intel-trigger').textContent=fmt(trigger,0)+' g';
  $('#reserve-trigger-marker').hidden=trigger===null;$('#reserve-trigger-label').hidden=trigger===null;
  $('#reserve-current-marker').hidden=view.percent===null;
  $('#reserve-wet-marker').hidden=!view.known;$('#reserve-dry-marker').hidden=!view.known;
  const place=n=>view.known?Math.max(0,Math.min(100,(view.wet-n)/(view.wet-view.dry)*100)):0;
  $('#reserve-wet-marker').style.left='0%';$('#reserve-dry-marker').style.left='100%';
  if(view.percent!==null)$('#reserve-current-marker').style.left=place(view.latest.w)+'%';
  if(trigger!==null)$('#reserve-trigger-marker').style.left=place(trigger)+'%';
  chart(view);eventList(view);
}
async function loadHistory(latest){
  const result=[],cutoff=new Date(Date.now()-30*86400000).toISOString();
  for(let offset=0;offset<5000;offset+=1000){
    let q=supabase.from('readings').select('id,weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).gte('created_at',cutoff).order('created_at',{ascending:false}).order('id',{ascending:false});
    q=latest.run_id?q.eq('run_id',latest.run_id):q.is('run_id',null);
    const {data,error}=await q.range(offset,offset+999);if(error)throw error;result.push(...(data||[]));if(!data||data.length<1000)break;
  }
  rows=result.sort((a,b)=>time(a)-time(b));
  let q=supabase.from('readings').select('id',{count:'exact',head:true}).eq('device_id',device.id);q=latest.run_id?q.eq('run_id',latest.run_id):q.is('run_id',null);
  const {count:total,error}=await q;if(error)throw error;count=total||0;
}
async function refresh(){
  if(loading||document.hidden)return;loading=true;
  try{
    const [{data:plantRow,error:plantError},{data:latestRows,error:readingError}]=await Promise.all([
      supabase.from('plants').select('*').eq('id',plant.id).eq('user_id',plant.user_id).maybeSingle(),
      supabase.from('readings').select('weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1)
    ]);
    if(plantError||readingError||!plantRow)throw plantError||readingError||Error('Plant unavailable');
    if(plantRow.device_id!==device.id)throw Error('The assigned tile changed. Reopen this plant.');
    plant=plantRow;const latest=latestRows?.[0],key=latest?JSON.stringify([stamp(latest),latest.weight_g,latest.run_id]):'';
    if(latest&&key!==latestKey){await loadHistory(latest);latestKey=key;}
    render();
  }catch(error){$('#plant-summary').textContent='Could not refresh this plant. Reopen the page to retry.';console.error(error);}
  finally{loading=false;}
}
async function init(){
  if(demo){
    $('#plant-demo-notice').hidden=false;
    plant={id:'demo',nickname:'Pot B',common_name:'Valencia Orange Seedling',botanical_name:'Citrus × sinensis',learned_saturated_g:629,provisional_dry_g:525,cycles_observed:0};
    device={device_code:'DemoTile'};
    const now=Date.now();rows=Array.from({length:289},(_,i)=>({weight_g:i<285?558-i*.1:i===285?11.5:i===286?656.2:i===287?633.4:629,temperature_c:22.7,measured_at:new Date(now-(288-i)*20*60000).toISOString(),run_id:'DEMO-REFILL'}));
    const percent=new URLSearchParams(location.search).get('reserve');if(percent!==null&&Number.isFinite(Number(percent)))rows.at(-1).weight_g=525+104*Math.max(0,Math.min(100,Number(percent)))/100;
    count=rows.length;
  }else{
    const {data:{session}}=await supabase.auth.getSession();if(!session){location.replace('account.html');return;}
    const id=new URLSearchParams(location.search).get('plant');let q=supabase.from('plants').select('*').eq('user_id',session.user.id);q=id?q.eq('id',id):q.eq('is_primary',true);
    const {data,error}=await q.limit(1);if(error||!data?.length)throw error||Error('Plant not found');plant=data[0];
    const result=await supabase.from('devices').select('*').eq('id',plant.device_id).maybeSingle();if(result.error||!result.data)throw result.error||Error('No tile assigned');device=result.data;
  }
  const asset=plantAssetFor(plant);setAsset($('#plant-hero-image'),asset);setAsset($('#plant-herbarium-image'),asset);
  document.title=name(plant)+' — Sykerbos';$('#plant-title').textContent=name(plant);$('#plant-species').textContent=[plant.common_name,plant.botanical_name].filter(Boolean).join(' · ');
  $('#plant-device-label').textContent=device.device_code;$('#herbarium-plant-name').textContent=plant.common_name||name(plant);$('#herbarium-botanical-name').textContent=plant.botanical_name||'';
  if(asset?.dossier){$('#herbarium-dossier-link').href=asset.dossier;$('#herbarium-dossier-link').textContent='Open full dossier →';}
  $('#water-vytile-button').href=demo?'watering.html?demo=1':'watering.html?plant='+encodeURIComponent(plant.id);
  if(demo){render();return;}
  await refresh();const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
init().catch(error=>{$('#plant-summary').textContent=error.message||'This plant could not be loaded.';console.error(error);});
