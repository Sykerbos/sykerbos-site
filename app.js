import {reservePercentLabel} from './watering-model.js?v=5';
import {supabase} from './supabase-client.js';
import {plantAssetFor} from './plant-assets.js';
import {collectionModel} from './collection-model.js?v=3';
import {collectionDemo} from './collection-demo.js?v=2';
const $=s=>document.querySelector(s);
const demo=['collection','watering'].includes(new URLSearchParams(location.search).get('demo'));
const stamp=r=>r?.measured_at||r?.created_at;
const time=r=>Date.parse(stamp(r));
const number=(v,d=1)=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=p=>p.nickname||p.common_name||'Your plant';
let collection=[],user=null,refreshing=false;
const historyCache=new Map();
function age(t){if(!Number.isFinite(t))return 'No readings yet';const m=Math.max(0,Math.round((Date.now()-t)/60000));return m<2?'Updated just now':m<60?`Updated ${m} min ago`:m<2880?`Last seen ${Math.round(m/60)} h ago`:`Last seen ${Math.round(m/1440)} days ago`;}
function sparkline(model){
 const chart=model.chart;if(chart.pot.length<2)return '<div class="collection-no-trend">Your next readings will build a trend.</div>';
 const span=Math.max(1,chart.end-chart.start),point=r=>[8+(time(r)-chart.start)/span*484,10+(chart.hi-Number(r.weight_g))/(chart.hi-chart.lo)*72];
 let d='',gap=true,previous=null;
 for(const r of chart.rows){if(Number(r.weight_g)<model.view.emptyFloor||chart.spikes.has(r)){gap=true;continue;}if(previous!==null&&time(r)-previous>90*60000)gap=true;const [x,y]=point(r);d+=(gap?'M':'L')+x.toFixed(1)+','+y.toFixed(1)+' ';gap=false;previous=time(r);}
 const event=chart.refill?point(chart.refill):null;
 return `<svg viewBox="0 0 500 92" role="img" aria-label="${chart.cycleFound?'Weight trend since the latest detected watering':'Recent weight trend'}"><path d="${d}"/>${event?`<circle cx="${event[0]}" cy="${event[1]}" r="4"/>`:''}</svg>`;
}
function card(p){
 const m=p.model,v=m.view,asset=plantAssetFor(p),plantLink=demo?'plant.html?demo=watering&collection='+encodeURIComponent(p.id):'plant.html?plant='+encodeURIComponent(p.id),waterLink=demo?'watering.html?demo=1':'watering.html?plant='+encodeURIComponent(p.id);
 const difference=v.abovePreviousLow;
 const comparison=difference===null?'Check your plant':Math.abs(difference)<.05?'At previous low':`${number(Math.abs(difference))} g ${difference>0?'above':'below'} previous low`;
 const estimate=v.previousLow||v.referenceReached?comparison:m.days===null?(m.percent===null?'Following your plant':'Water reserve'):v.state==='low'?'Time for a check':`About ${m.days} day${m.days===1?'':'s'} in reserve`;
 const state=m.priority===0?'attention':!v.fresh||v.maintenance?'offline':'growing';
 const last=v.cycle.refill?new Date(v.cycle.refill.at).toLocaleDateString(undefined,{day:'numeric',month:'short'}):null;
 const lastCopy=last?`Watered ${last}`:'Following the current dry-down';
 const refillText=m.refill===null?'—':`${Math.round(m.refill)} mL`;
 const measurements=`<dl><div><dt>Current weight</dt><dd>${number(v.latest?.w)} g</dd></div><div><dt>Temperature</dt><dd>${number(v.latest?.temperature_c)} °C</dd></div><div><dt>Current daily loss</dt><dd>${number(v.rate)} g/day</dd></div><div><dt>Planning daily loss</dt><dd>${number(v.usage.rate)} g/day</dd></div><div><dt>Refill to saved full weight</dt><dd>${refillText}</dd></div><div><dt>Full weight</dt><dd>${number(v.wet,0)} g</dd></div><div><dt>${v.dry!==null&&p.learned_dry_g==null?'Setup dry weight':'Dry weight'}</dt><dd>${v.dry===null?'Learning':number(v.dry,0)+' g'}</dd></div><div><dt>Reliable days</dt><dd>${v.usage.qualifyingDays}</dd></div></dl>`;
 return `<article class="collection-plant ${state}"><a class="collection-photo" href="${plantLink}" aria-label="Open ${safe(title(p))}">${asset?`<img src="${asset.image}" alt="" loading="lazy">`:`<span class="collection-monogram">${safe(title(p).slice(0,1))}</span>`}<span class="collection-status">${safe(m.label)}</span></a><div class="collection-copy"><div class="collection-heading"><div><p class="collection-species">${safe(p.common_name||p.device?.device_code||'Your plant')}</p><h2><a href="${plantLink}">${safe(title(p))}</a></h2><p class="collection-estimate">${estimate}</p></div><div class="collection-reserve ${m.percent===null?'unknown':''}" style="--reserve:${m.percent??0}%" role="img" aria-label="${v.referenceReached?'Dry reference reached; water reserve unavailable':m.percent===null?'Water reserve unavailable':`Estimated water reserve ${reservePercentLabel(v.percent)}`}"><span>${v.referenceReached?'Check':safe(reservePercentLabel(v.percent))}<small>reserve</small></span></div></div><div class="collection-trend">${sparkline(m)}</div><div class="collection-trend-meta"><span>${lastCopy}</span><span>${safe(age(v.latest?.t))}</span></div><div class="collection-actions"><a class="button" href="${waterLink}">${demo?'Try watering':!v.fresh||v.maintenance?'Open VyTile':'Water plant'} <span aria-hidden="true">↗</span></a><a class="text-link" href="${plantLink}">Plant story →</a></div><details class="collection-measurements" data-plant="${safe(p.id)}"><summary>Measurements & calculations</summary>${measurements}<p>Reserve compares the current weight with this pot’s saved full and dry weights. Days use its higher-use measured days; loss includes evaporation.</p></details></div></article>`;
}
function render(){
 const opened=new Set([...document.querySelectorAll('.collection-measurements[open]')].map(el=>el.dataset.plant));
 const plants=collection.map(p=>({...p,model:collectionModel(p,p.history,{device:p.device})})).sort((a,b)=>a.model.priority-b.model.priority||(a.model.percent??101)-(b.model.percent??101)||(a.display_order??0)-(b.display_order??0));
 $('#plant-list').innerHTML=plants.length?plants.map(card).join(''):'<div class="collection-empty"><p class="eyebrow">Your first plant</p><h2>Start growing your collection.</h2><p>Connect a VyTile and add the plant it will follow.</p><a class="button" href="start.html?new=1">Set up a VyTile →</a></div>';
 document.querySelectorAll('.collection-measurements').forEach(el=>{if(opened.has(el.dataset.plant))el.open=true;});
 const online=plants.filter(p=>p.model.view.fresh&&!p.model.view.maintenance).length;
 $('#collection-summary').textContent=plants.length?`${plants.length} plant${plants.length===1?'':'s'} · ${online} VyTile${online===1?'':'s'} reporting`:'Your garden starts here.';
 $('#device-summary').textContent=plants.length?`${online} of ${plants.filter(p=>p.device).length} VyTiles reporting`:'Connect your first VyTile.';
 if(demo){document.querySelectorAll('a[href="herbarium.html"]').forEach(a=>a.href='herbarium.html?demo=1');document.querySelectorAll('a[href="app.html"]').forEach(a=>a.href='app.html?demo=collection');}
}
async function loadHistory(device,latest){
 const key=JSON.stringify([stamp(latest),latest.weight_g,latest.run_id]);
 const cached=historyCache.get(device.id);if(cached?.key===key)return cached.rows;
 const rows=[],anchor=new Date(Date.now()).toISOString();
 for(let offset=0;offset<10000;offset+=1000){
  let query=supabase.from('readings').select('id,weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).lte('created_at',anchor).order('created_at',{ascending:false}).order('id',{ascending:false});
  query=latest.run_id?query.eq('run_id',latest.run_id):query.is('run_id',null);
  const {data,error}=await query.range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;
 }
 if(!rows.some(r=>stamp(r)===stamp(latest)))rows.push(latest);
 rows.sort((a,b)=>time(a)-time(b));historyCache.set(device.id,{key,rows});return rows;
}
async function loadPlantData(){
 const {data:plants,error}=await supabase.from('plants').select('id,device_id,nickname,common_name,botanical_name,status,display_order,learned_dry_g,learned_saturated_g,provisional_dry_g,provisional_saturated_g').eq('user_id',user.id).order('display_order',{ascending:true});if(error)throw error;
 const ids=[...new Set((plants||[]).map(p=>p.device_id).filter(Boolean))];
 let devices=[];if(ids.length){const result=await supabase.from('devices').select('id,device_code,model,status').in('id',ids);if(result.error)throw result.error;devices=result.data||[];}
 const map=new Map(devices.map(d=>[d.id,d]));
 collection=await Promise.all((plants||[]).map(async p=>{
  const device=map.get(p.device_id)||null;if(!device)return {...p,device,history:[]};
  const result=await supabase.from('readings').select('weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1);if(result.error)throw result.error;
  const latest=result.data?.[0];return {...p,device,history:latest?await loadHistory(device,latest):[]};
 }));render();
}
function demoPlants(){return collectionDemo(new URLSearchParams(location.search).get('state'));}
async function refresh(){if(refreshing||document.hidden)return;refreshing=true;try{await loadPlantData();$('#collection-error').hidden=true;}catch(error){console.error(error);$('#collection-error').textContent=collection.length?'Could not refresh. Showing the last loaded readings.':'Could not load your plants. Reload this page to try again.';$('#collection-error').hidden=false;$('#collection-summary').textContent='Connection interrupted';}finally{refreshing=false;}}
async function init(){
 if(demo){$('#dashboard-demo-notice').hidden=false;$('#profile-button').textContent='D';$('#profile-button').setAttribute('aria-label','Demo account');collection=demoPlants();render();return;}
 const {data:{session},error}=await supabase.auth.getSession();if(error)throw error;if(!session){location.replace('account.html');return;}user=session.user;
 $('#profile-button').textContent=user.is_anonymous?'G':(user.email||'S').slice(0,2).toUpperCase();
 await refresh();const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
$('#profile-button').addEventListener('click',async()=>{if(demo)return;if(confirm('Sign out of Sykerbos on this device?')){await supabase.auth.signOut();location.href='account.html';}});
init().catch(error=>{console.error(error);$('#collection-summary').textContent='Unable to connect';$('#collection-error').textContent='Could not open your collection. Reload this page to try again.';$('#collection-error').hidden=false;});
