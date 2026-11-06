import {collectionDemo} from './collection-demo.js?v=1';
import {supabase} from './supabase-client.js';
import {plantAssetFor} from './plant-assets.js';
import {plantState} from './plant-state.js?v=3';
import {plantTrendModel} from './plant-trend-model.js?v=2';
import {plantTrendSvg} from './plant-trend-render.js?v=1';

const $=s=>document.querySelector(s);
const fmt=(n,d=1)=>n!==null&&n!==undefined&&Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const stamp=r=>r?.measured_at||r?.created_at;
const time=r=>Date.parse(stamp(r));
const name=p=>p.nickname||p.common_name||'Your plant';
let plant=null,device=null,rows=[],count=0,chartRange='cycle',latestKey='',loading=false;
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
  document.querySelectorAll('.range-pills button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  chartRange=button.dataset.range;render();
}));
const chartLayers={previous:true,temperature:true,forecast:true};
document.querySelectorAll('[data-chart-layer]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.chartLayer;chartLayers[key]=!chartLayers[key];button.setAttribute('aria-pressed',String(chartLayers[key]));render();}));
function chart(view){
  const model=plantTrendModel(rows,view,{range:chartRange});
  const host=$('#plant-chart');
  host.classList.add('plant-context-chart');
  host.style.height=chartLayers.temperature&&model.temperature.length?'398px':'302px';
  host.innerHTML=plantTrendSvg(model,{width:host.clientWidth||800,...chartLayers});
  for(const layer of ['previous','temperature','forecast']){const button=document.querySelector(`[data-chart-layer="${layer}"]`);button.hidden=!model[layer].length;}
  $('#plant-chart-dates').textContent='';
  const date=t=>new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  $('#plant-chart-note').textContent=model.refill?`Last watered ${date(model.refill.t)}${model.forecast.length&&chartLayers.forecast?' · projected to '+date(model.plotEnd):''}`:'Measured weight history';
  $('#plant-chart-method').textContent=(model.previousRefill?'The lighter line shows the previous cycle at its original dates and weights. ':'')+(model.method==='cycle-adjusted'?'The dashed projection uses the previous cycle’s pattern, adjusted to the latest measured daily loss.':model.method==='recent-trend'?'The dashed projection continues the latest uninterrupted day’s measured loss.':'A projection appears after an uninterrupted day of fresh readings.')+' Temperature is measured context; it is not used as a demand multiplier. Empty-tile readings, isolated handling spikes and recording gaps are omitted from the weight lines.';
}
let chartWidth=0;
new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(width>0&&Math.abs(width-chartWidth)>1){chartWidth=width;if(plant)render();}}).observe($('#plant-chart'));

function renderCycles(cycles){
  const host=$('#cycle-history'),opened=new Set([...host.querySelectorAll('article')].filter(el=>el.querySelector('details')?.open).map(el=>el.dataset.cycle));host.replaceChildren();
  if(!cycles.length){const p=document.createElement('p');p.className='panel-note';p.textContent='Water your plant to begin its history.';host.append(p);return;}
  const date=t=>new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  for(const [index,c] of [...cycles].reverse().entries()){
    const article=document.createElement('article');article.className='cycle-history-card';article.dataset.cycle=String(c.at);
    const badge=document.createElement('span');badge.className='cycle-history-status'+(c.completed?' completed':'');badge.textContent=c.completed?'Completed':'In progress';
    const h=document.createElement('h3');h.textContent=c.completed?'Previous cycle'+(index>1?' · '+(cycles.length-index):''):'Current cycle';
    const dates=document.createElement('p');dates.className='cycle-history-dates';dates.textContent=date(c.at)+' → '+(c.completed?date(c.endedAt):'latest reading');
    const duration=document.createElement('strong');duration.className='cycle-history-duration';duration.textContent=fmt(c.days)+' days';
    const weights=document.createElement('p');weights.className='cycle-history-weights';weights.textContent=fmt(c.startWeight)+' → '+fmt(c.endWeight)+' g';
    const loss=document.createElement('p');loss.className='cycle-history-loss';loss.textContent=(c.netLoss>=0?'−':'+')+fmt(Math.abs(c.netLoss))+' g net change';
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Cycle details';details.open=opened.has(String(c.at));details.append(summary);
    for(const text of [c.weightGain!==null?'Weight gained at watering: +'+fmt(c.weightGain)+' g':null,c.readings+' on-pot readings',c.gapHours?fmt(c.gapHours)+' h recording gap':null,c.handling?'Handling readings omitted':null]){if(text){const p=document.createElement('p');p.textContent=text;details.append(p);}}
    article.append(badge,h,dates,duration,weights,loss,details);host.append(article);
  }
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

  const detected=plantTrendModel(rows,view).cycles;
  const completed=detected.filter(c=>c.completed).length,ongoing=detected.length-completed;
  $('#plant-intelligence-title').textContent=name(plant)+'’s cycles.';
  $('#plant-intelligence-copy').textContent=detected.length?`${detected.length} watering${detected.length===1?'':'s'} · ${completed} completed · ${ongoing} ongoing`:'Your first detected watering will start the cycle history.';
  $('#plant-learning-note').textContent=`${view.latest?.run_id||'Current measurement run'} · ${count.toLocaleString()} readings${count>rows.length?' · latest '+rows.length.toLocaleString()+' loaded':''}`;
  renderCycles(detected);
  $('#high-use-rate').textContent=view.usage.rate===null?'Learning':fmt(view.usage.rate);
  $('#high-use-days').textContent=String(view.usage.qualifyingDays);
  $('#new-cycle-readings').textContent=String(segment.length);
  $('#use-evidence').textContent=view.usage.qualifyingDays<7?'Early evidence':'Measured';
  $('#use-method-note').textContent=view.usage.rate===null?'At least 3 reliable full days are needed. No fixed species rate is assumed.':`g/day · average of the higher-use ${view.usage.usedDays} of ${view.usage.qualifyingDays} reliable days in this run. Weight loss includes evaporation.`;
  $('#intelligence-current-rate').textContent=view.rate===null?'Learning':fmt(view.rate)+' g/day';
  $('#confidence-title').textContent='Watering cycles';
  $('#confidence-number').textContent=String(detected.length);
  $('#cycles-completed').textContent=String(completed);
  $('#cycles-ongoing').textContent=String(ongoing);
  $('#evidence-cycles').textContent=`${completed} completed · ${ongoing} ongoing`;
  $('#evidence-slope').textContent=view.rate===null?'Dry-down rebuilding':fmt(view.rate)+' g/day measured';
  $('#evidence-reserve').textContent=view.known?`Full ${fmt(view.wet,0)} g · dry ${fmt(view.dry,0)} g`:'References still needed';
  $('#evidence-next').textContent=ongoing?'Following the current cycle':'Waiting for the next watering';
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
  const result=[];
  for(let offset=0;offset<10000;offset+=1000){
    let q=supabase.from('readings').select('id,weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).order('created_at',{ascending:false}).order('id',{ascending:false});
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
    if(new URLSearchParams(location.search).get('trend')==='drydown'){
      plant.learned_saturated_g=640;
      rows=Array.from({length:289},(_,i)=>({weight_g:i<72?550-i*.1:640-(i-72)*.19,temperature_c:22.7,measured_at:new Date(now-(288-i)*20*60000).toISOString(),run_id:'DEMO-DRYDOWN'}));
    }
    if(new URLSearchParams(location.search).get('trend')==='handling'){
      const weights=[529.9,11.5,641.2,639.8,656.2,636.6,633.4,629,630.9,629.3,628.1,628.1,798.6,635.6,650.4,631.1,628.4];
      rows=Array.from({length:210},(_,i)=>({weight_g:weights[i]??(628.4-(i-16)*.18),temperature_c:22.7,measured_at:new Date(now-(209-i)*20*60000).toISOString(),run_id:'DEMO-HANDLING'}));
    }
    const percent=new URLSearchParams(location.search).get('reserve');if(percent!==null&&Number.isFinite(Number(percent)))rows.at(-1).weight_g=525+104*Math.max(0,Math.min(100,Number(percent)))/100;
    const sample=collectionDemo().find(p=>p.id===new URLSearchParams(location.search).get('collection'));
    if(sample){plant={...sample,cycles_observed:0};device=sample.device;rows=sample.history;}
    count=rows.length;
    document.querySelectorAll('a[href="app.html"],a[href="plants.html"]').forEach(a=>a.href='app.html?demo=collection');
    document.querySelectorAll('a[href="herbarium.html"]').forEach(a=>a.href='herbarium.html?demo=1');
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
