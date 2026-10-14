import { supabase } from './supabase-client.js';
import { plantAssetFor } from './plant-assets.js';

const $=s=>document.querySelector(s);
const fmt=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const stampOf=r=>r?.measured_at||r?.created_at||null;
const timeOf=r=>new Date(stampOf(r)||0).getTime();

const tabs=[...document.querySelectorAll('.plant-tabs button')];
const panels=[...document.querySelectorAll('.plant-tab-panel')];
tabs.forEach(button=>button.addEventListener('click',()=>{
  const target=button.dataset.tab;
  tabs.forEach(b=>b.classList.toggle('active',b===button));
  panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===target));
  history.replaceState(null,'',location.pathname+location.search+'#'+target);
}));
const hash=location.hash.replace('#','');
if(hash){const button=tabs.find(b=>b.dataset.tab===hash);if(button) button.click();}

function plantName(p){return p.nickname||p.common_name||'Unnamed plant';}
function species(p){return [p.common_name,p.botanical_name].filter(Boolean).join(' · ');}
function ageLabel(value){
  if(!value) return 'No recent reading';
  const m=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/60000));
  if(m<2)return 'just now'; if(m<60)return m+' min ago';
  const h=Math.round(m/60); if(h<48)return h+' h ago';
  return Math.round(h/24)+' d ago';
}
function setAsset(el,asset){
  if(!el) return;
  if(asset){el.style.backgroundImage=`url("${asset.image}")`;el.classList.add('has-image');}
  else{el.style.backgroundImage='none';el.classList.remove('has-image');}
}

function drawChart(readings){
  const host=$('#plant-chart');
  const pts=readings.filter(r=>Number.isFinite(Number(r.weight_g))&&stampOf(r)).sort((a,b)=>timeOf(a)-timeOf(b));
  if(pts.length<2){host.innerHTML='<div class="chart-loading">Not enough weight readings for this range.</div>';return;}
  const vals=pts.map(r=>Number(r.weight_g)), min=Math.min(...vals), max=Math.max(...vals), range=Math.max(1,max-min);
  const w=900,h=300,p=28;
  const coords=pts.map((r,i)=>[p+(i/(pts.length-1))*(w-2*p),p+((max-Number(r.weight_g))/range)*(h-2*p)]);
  const path=coords.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)).join(' ');
  host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Weight history">
    <line x1="${p}" y1="${p}" x2="${w-p}" y2="${p}" class="plant-grid-line"/>
    <line x1="${p}" y1="${h/2}" x2="${w-p}" y2="${h/2}" class="plant-grid-line"/>
    <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" class="plant-grid-line"/>
    <path d="${path}" class="plant-live-line"/>
  </svg><span class="plant-y top">${max.toFixed(0)} g</span><span class="plant-y bottom">${min.toFixed(0)} g</span>`;
  $('#range-net-change').textContent=(vals.at(-1)-vals[0]>=0?'+':'')+(vals.at(-1)-vals[0]).toFixed(1)+' g';
}

function recentEvents(readings){
  const host=$('#event-list');
  const pts=[...readings].sort((a,b)=>timeOf(b)-timeOf(a)).slice(0,3);
  host.innerHTML=pts.map((r,i)=>`<article><span class="event-icon">${i===0?'●':'·'}</span><div><strong>${fmt(r.weight_g)} g · ${fmt(r.temperature_c)} °C</strong><small>${new Date(stampOf(r)).toLocaleString()}</small></div></article>`).join('');
}

async function loadRange(deviceId,hours){
  const since=new Date(Date.now()-hours*3600000).toISOString();
  const {data,error}=await supabase.from('readings')
    .select('weight_g,temperature_c,measured_at,created_at')
    .eq('device_id',deviceId)
    .gte('created_at',since)
    .order('created_at',{ascending:true})
    .limit(5000);
  if(error) throw error;
  drawChart(data||[]);
  recentEvents(data||[]);
  $('#plant-chart-note').textContent=`${(data||[]).length.toLocaleString()} readings in this range`;
}

async function init(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.replace('account.html');return;}
  const user=session.user;
  const id=new URLSearchParams(location.search).get('plant');

  let q=supabase.from('plants').select('*').eq('user_id',user.id);
  if(id) q=q.eq('id',id); else q=q.eq('is_primary',true);
  const {data:rows,error}=await q.limit(1);
  if(error||!rows?.length){
    $('#plant-title').textContent='Plant not found';
    $('#plant-summary').textContent='Return home and choose a plant from your collection.';
    return;
  }
  const p=rows[0];
  const asset=plantAssetFor(p);
  document.title=plantName(p)+' — Sykerbos';
  $('#plant-title').textContent=plantName(p);
  $('#plant-species').textContent=species(p)||'Your plant';
  $('#herbarium-plant-name').textContent=p.common_name||plantName(p);
  $('#herbarium-botanical-name').innerHTML=p.botanical_name?'<em>'+p.botanical_name+'</em>':'';
  setAsset($('#plant-hero-image'),asset);
  setAsset($('#plant-herbarium-image'),asset);
  if(asset?.dossier){$('#herbarium-dossier-link').href=asset.dossier;$('#herbarium-dossier-link').textContent='Open full dossier →';}

  const {data:device}=await supabase.from('devices').select('*').eq('id',p.device_id).maybeSingle();
  if(!device){$('#plant-summary').textContent='No VyTile is assigned to this plant.';return;}
  $('#plant-device-label').textContent=device.device_code;

  const [{data:latestRows},{data:summaryRows}]=await Promise.all([
    supabase.from('readings').select('weight_g,temperature_c,measured_at,created_at').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1),
    supabase.from('device_reading_summary').select('*').eq('device_id',device.id).limit(1)
  ]);
  const latest=latestRows?.[0]||null, summary=summaryRows?.[0]||null;
  const fresh=stampOf(latest)&&(Date.now()-new Date(stampOf(latest)).getTime()<90*60000);
  const maintenance=p.status==='offline'||device.status==='maintenance';
  $('#plant-status').textContent=maintenance?'Maintenance':fresh?'Connected':'Last seen '+ageLabel(stampOf(latest));
  $('#plant-status').className='status '+(maintenance?'offline':fresh?'good':'learning');
  if(maintenance){
    $('#plant-summary').textContent=`${plantName(p)} is currently offline while ${device.device_code} is awaiting an electronics rebuild. Historical readings remain available below.`;
  }
  $('#plant-weight').textContent=latest?fmt(latest.weight_g)+' g':'—';
  $('#plant-temperature').textContent=latest?fmt(latest.temperature_c)+' °C':'—';
  $('#plant-reading-count').textContent=Number(summary?.reading_count||0).toLocaleString();
  if(!maintenance){
    $('#plant-summary').textContent=`${plantName(p)} is linked to ${device.device_code}. This page is now using its recorded weight and temperature history.`;
  }

  const low=Number(summary?.p05_weight_g), high=Number(summary?.p95_weight_g), current=Number(latest?.weight_g);
  if(Number.isFinite(low)&&Number.isFinite(high)&&high>low&&Number.isFinite(current)){
    const percent=Math.max(0,Math.min(100,((current-low)/(high-low))*100));
    $('#radial-gauge').style.setProperty('--level',percent.toFixed(1));
    $('#range-percent').textContent=Math.round(percent)+'%';
    $('#range-low').textContent=low.toFixed(1)+' g'; $('#range-high').textContent=high.toFixed(1)+' g';
    $('#range-low-side').textContent=low.toFixed(0)+' g'; $('#range-high-side').textContent=high.toFixed(0)+' g';
    $('#plant-action-title').textContent=percent<20?'Near the dry end of its observed range.':percent>80?'Near the wet end of its observed range.':'Inside its observed range.';
    $('#plant-action-copy').textContent=`Current weight is ${Math.round(percent)}% of the way from the lowest to highest recorded weight. This is descriptive, not yet a watering recommendation.`;
  }

  const count=Number(summary?.reading_count||0);
  $('#plant-intelligence-title').textContent='Learning '+plantName(p)+'.';
  $('#plant-intelligence-copy').textContent=`Sykerbos has ${count.toLocaleString()} readings from ${device.device_code}. We can now build irrigation recognition and plant-specific thresholds on top of real history.`;
  $('#plant-learning-bar').style.width=Math.min(100,Math.round(count/20))+'%';
  $('#plant-learning-note').textContent=count.toLocaleString()+' recorded readings';

  const rangeButtons=[...document.querySelectorAll('.range-pills button')];
  const hoursFor={'24h':24,'7d':168,'30d':720};
  rangeButtons.forEach(button=>button.addEventListener('click',async()=>{
    rangeButtons.forEach(b=>b.classList.toggle('active',b===button));
    await loadRange(device.id,hoursFor[button.textContent.trim()]||24);
  }));
  await loadRange(device.id,24);
}

init();
