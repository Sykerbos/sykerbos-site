import {collectionDemo} from './collection-demo.js?v=2';
import {plantAssetFor} from './plant-assets.js';
import {plantState} from './plant-state.js?v=6';
import {plantDrydownGauge} from './plant-drydown-gauge.js?v=1';
import {plantActivity} from './plant-activity.js?v=1';
import {wateringDisplayRows} from './watering-handoff.js?v=1';
import {plantTrendModel} from './plant-trend-model.js?v=3';
import {plantTrendSvg} from './plant-trend-render.js?v=1';

const $=s=>document.querySelector(s);
const fmt=(n,d=1)=>n!==null&&n!==undefined&&Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const stamp=r=>r?.measured_at||r?.created_at;
const time=r=>Date.parse(stamp(r));
const name=p=>p.nickname||p.common_name||'Your plant';
let plant=null,device=null,rows=[],count=0,chartRange='cycle',latestKey='',loading=false,supabase=null;
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
function chart(view,displayRows=rows){
  const model=plantTrendModel(displayRows,view,{range:chartRange});
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

const activityIcons={dry:'<path d="M3 5l6 6 4-4 8 9m-6 0h6v-6"/>',water:'<path d="M12 3c3 4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-7 6-11Z"/>',cycle:'<path d="M4 11a8 8 0 1 1 3 7m-3-2v-5h5"/>',signal:'<path d="M2 12h5l3-6 4 12 3-6h5"/>'};
function eventList(view,dial,cycles){
  const host=$('#event-list');host.replaceChildren();
  const events=plantActivity(view,dial,cycles,rows);
  for(const event of events){
    const item=document.createElement('li'),icon=document.createElement('span'),body=document.createElement('div');
    const title=document.createElement('strong'),copy=document.createElement('span'),date=document.createElement('time');
    item.dataset.kind=event.kind;icon.className='event-icon';icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+activityIcons[event.kind]+'</svg>';
    title.textContent=event.title;copy.textContent=event.copy;
    date.dateTime=new Date(event.at).toISOString();
    date.textContent=event.live?'Current cycle':new Date(event.at).toLocaleDateString(undefined,{day:'numeric',month:'short'});
    body.append(title,copy);item.append(icon,body,date);host.append(item);
  }
  $('#activity-empty').hidden=events.length>0;
  const raw=$('#activity-readings');raw.replaceChildren();
  const samples=rows.slice(-3).reverse();$('#activity-details').hidden=!samples.length;
  for(const r of samples){
    const item=document.createElement('li'),label=document.createElement('span'),value=document.createElement('strong');
    const at=time(r);label.textContent=Number.isFinite(at)?new Date(at).toLocaleString():'Unknown time';
    value.textContent=fmt(r.weight_g)+' g · '+fmt(r.temperature_c)+' °C';
    item.append(label,value);raw.append(item);
  }
}
function render(){
  if(!plant)return;
  const maintenance=plant.status==='offline'||device?.status==='maintenance';
  const displayRows=demo?rows:wateringDisplayRows({userId:plant.user_id,plantId:plant.id,deviceId:device.id,deviceCode:device.device_code},rows);
  const view=plantState(plant,displayRows,{maintenance}),cycle=view.cycle;
  $('#plant-status').textContent=maintenance?'Maintenance':view.fresh?'Connected':'Last seen '+age(view.latest?.t);
  $('#plant-status').className='status '+(maintenance?'offline':view.fresh?'good':'learning');
  if(!maintenance&&view.latest?.source==='live-watering')$('#plant-status').textContent='Watered · waiting to sync';
  $('#plant-weight').textContent=view.latest?fmt(view.latest.w)+' g':'—';
  $('#plant-temperature').textContent=view.latest?fmt(view.latest.temperature_c)+' °C':'—';
  $('#plant-reading-count').textContent=count.toLocaleString();
  const summaries={maintenance:'This tile is in maintenance. Historical readings remain available.',removed:'The pot appears removed. Reserve estimates are paused.',stale:'Waiting for a fresh tile reading.',reference:'Dry reference reached. Check your plant.',low:'Low against the saved range. Check the leaves.',refill:'Recently watered. Watching the pot settle and begin its next dry-down.',drying:'Following this watering cycle.'};
  $('#plant-summary').textContent=summaries[view.state];
  if(!maintenance&&view.latest?.source==='live-watering')$('#plant-summary').textContent='Latest watering weight · waiting for the next stored reading.';

  const gauge=$('#radial-gauge'),dial=plantDrydownGauge(view,plant.learned_saturated_g);
  gauge.dataset.known=String(dial.angle!==null);
  gauge.style.setProperty('--angle',(dial.angle??225)+'deg');
  gauge.setAttribute('role','img');gauge.setAttribute('aria-label',dial.label+' · '+dial.caption);
  $('#range-percent').textContent=dial.label;
  $('#range-caption').textContent=dial.caption;
  $('#range-percent').classList.toggle('learning-reserve',!dial.label.endsWith('%'));
  $('#range-low-side').textContent=dial.low===null?'—':fmt(dial.low)+' g';
  $('#range-high-side').textContent=dial.full===null?'—':fmt(dial.full)+' g';

  $('#plant-current-rate').textContent=view.rate===null?'Learning':fmt(view.rate)+' g/day';
  $('#plant-current-rate-note').textContent=view.rate!==null?'Since watering or repositioning':cycle.recent?'Rebuilding after watering':'Waiting for an uninterrupted dry-down';
  const segment=cycle.segment;
  const movement=segment.length>1?segment.at(-1).w-segment[0].w:null;
  $('#plant-recent-movement').textContent=movement===null?'—':(movement>0?'+':'')+fmt(movement)+' g';
  $('#plant-recent-movement-note').textContent='This uninterrupted dry-down';
  $('#plant-projected-label').textContent=view.previousLow?'Previous cycle low':'Projected reserve';
  $('#plant-projected-days').textContent=view.previousLow?fmt(view.previousLow.weight)+' g':view.referenceReached?'Not estimated':view.days===null?'Learning':view.days<.1?'<0.1 days':'~'+fmt(view.days)+' days';
  const difference=view.abovePreviousLow;
  const comparison=difference===null?'Dry reference reached':Math.abs(difference)<.05?'At that low now':`${fmt(Math.abs(difference))} g ${difference>0?'above':'below'} that low now`;
  $('#plant-projected-note').textContent=view.previousLow||view.referenceReached?comparison:view.days===null?'Waiting for reliable daily use and references':`${fmt(view.reserve)} g reserve · ${fmt(view.usage.rate)} g/day${view.usage.qualifyingDays<7?' · early estimate':''}`;
  $('#plant-action-title').textContent={maintenance:'Tile in maintenance.',removed:'Return the pot.',stale:'Waiting for a reading.',reference:'Check your plant.',low:'Check your plant.',refill:'Recently watered.',drying:'Follow the dry-down.'}[view.state];
  $('#plant-action-copy').textContent={maintenance:'Historical readings remain available while the tile is in maintenance.',removed:'Return the pot to resume water reserve and dry-down readings.',stale:'Reconnect the tile before relying on its current reserve estimate.',reference:view.rate>0?`Still losing ${fmt(view.rate)} g/day. Check the pot before watering.`:'Check the pot before watering.',low:'Check the leaves and pot before watering.',refill:'Let excess water drain. The new dry-down rate appears once enough uninterrupted readings arrive.',drying:'Follow the curve between waterings.'}[view.state];
  if(dial.late){
    $('#plant-action-title').textContent=dial.newLow?'New observed low.':'Late dry-down.';
    $('#plant-action-copy').textContent=dial.newLow?'Check the leaves and note how the plant looks at this weight.':`${dial.slowed?'Weight loss has slowed to':'Still losing'} ${fmt(view.rate)} g/day. Check the leaves before deciding when to water.`;
  }

  const detected=plantTrendModel(displayRows,view).cycles;
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
  $('#evidence-cycles').textContent=String(completed);
  $('#evidence-slope').textContent=view.rate===null?'Dry-down rebuilding':fmt(view.rate)+' g/day measured';
  $('#evidence-reserve').textContent=view.observedLow?fmt(view.observedLow.weight)+' g':view.known?`Full ${fmt(view.wet,0)} g · dry ${fmt(view.dry,0)} g`:'References still needed';
  $('#evidence-next').textContent=ongoing?'Following the current cycle':'Waiting for the next watering';
  $('#intel-wet').textContent=fmt(view.wet,0)+' g';$('#intel-dry').textContent=fmt(view.dry,0)+' g';$('#intel-current').textContent=fmt(view.latest?.w)+' g';
  $('#reserve-map-card').hidden=!view.known||view.referenceReached;
  const trigger=view.known&&!view.referenceReached&&view.usage.rate>0?Math.min(view.wet,view.dry+view.usage.rate*3):null;
  $('#intel-trigger').textContent=fmt(trigger,0)+' g';
  $('#reserve-trigger-marker').hidden=trigger===null;$('#reserve-trigger-label').hidden=trigger===null;
  $('#reserve-current-marker').hidden=view.percent===null;
  $('#reserve-wet-marker').hidden=!view.known;$('#reserve-dry-marker').hidden=!view.known;
  const place=n=>view.known?Math.max(0,Math.min(100,(view.wet-n)/(view.wet-view.dry)*100)):0;
  $('#reserve-wet-marker').style.left='0%';$('#reserve-dry-marker').style.left='100%';
  if(view.percent!==null)$('#reserve-current-marker').style.left=place(view.latest.w)+'%';
  if(trigger!==null)$('#reserve-trigger-marker').style.left=place(trigger)+'%';
  chart(view,displayRows);eventList(view,dial,detected);
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
    const sample=collectionDemo(new URLSearchParams(location.search).get('state')).find(p=>p.id===new URLSearchParams(location.search).get('collection'));
    if(sample){plant={...sample,cycles_observed:0};device=sample.device;rows=sample.history;}
    count=rows.length;
    document.querySelectorAll('a[href="app.html"],a[href="plants.html"]').forEach(a=>a.href='app.html?demo=collection');
    document.querySelectorAll('a[href="app.html#settings"]').forEach(a=>a.href='app.html?demo=collection#settings');
    document.querySelectorAll('a[href="herbarium.html"]').forEach(a=>a.href='herbarium.html?demo=1');
  }else{
    ({supabase}=await import('./supabase-client.js'));
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
  window.addEventListener('storage',e=>{if(e.key?.startsWith('sykerbos:watering-weight:'))render();});
  window.addEventListener('pageshow',()=>{render();void refresh();});
}
init().catch(error=>{$('#plant-summary').textContent=error.message||'This plant could not be loaded.';console.error(error);});
