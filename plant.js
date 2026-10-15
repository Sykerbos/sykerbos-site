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
function readingNear(readings,hoursAgo,anchor,toleranceMinutes=75){
  if(!readings?.length||!anchor) return null;
  const target=timeOf(anchor)-hoursAgo*3600000;
  let best=null,bestDiff=Infinity;
  for(const r of readings){
    const diff=Math.abs(timeOf(r)-target);
    if(diff<bestDiff){best=r;bestDiff=diff;}
  }
  return bestDiff<=toleranceMinutes*60000?best:null;
}
function delta(oldReading,newReading){
  const a=Number(oldReading?.weight_g),b=Number(newReading?.weight_g);
  return Number.isFinite(a)&&Number.isFinite(b)?b-a:null;
}
function showDelta(selector,n){
  const el=$(selector);
  if(!el) return;
  el.textContent=n===null?'—':(n>0?'+':'')+n.toFixed(1)+' g';
}
function slopePerDay(readings){
  const pts=(readings||[])
    .filter(r=>Number.isFinite(Number(r.weight_g))&&stampOf(r))
    .map(r=>({x:timeOf(r)/1000,y:Number(r.weight_g)}));
  if(pts.length<3) return null;
  const mx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
  const my=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  const num=pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
  const den=pts.reduce((s,p)=>s+(p.x-mx)*(p.x-mx),0);
  return den?num/den*86400:null;
}
function windowReadings(readings,hours,anchor){
  if(!anchor) return [];
  const cutoff=timeOf(anchor)-hours*3600000;
  return (readings||[]).filter(r=>timeOf(r)>=cutoff&&timeOf(r)<=timeOf(anchor));
}
function showDryDown(selector,slope){
  const el=$(selector);
  if(!el) return;
  if(slope===null){el.textContent='—';return;}
  el.textContent=slope<0?Math.abs(slope).toFixed(1)+' g/day':'+'+slope.toFixed(1)+' g/day';
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

async function loadRange(deviceId,hours,runId=null){
  const {data:latestRows,error:latestError}=await supabase.from('readings')
    .select('weight_g,temperature_c,measured_at,created_at,run_id')
    .eq('device_id',deviceId)
    .order('measured_at',{ascending:false,nullsFirst:false})
    .order('created_at',{ascending:false})
    .limit(1);
  if(latestError) throw latestError;
  const anchor=latestRows?.[0];
  if(!anchor){
    drawChart([]);
    return;
  }
  const since=new Date(timeOf(anchor)-hours*3600000).toISOString();
  let rangeQuery=supabase.from('readings')
    .select('weight_g,temperature_c,measured_at,created_at,run_id')
    .eq('device_id',deviceId)
    .gte('measured_at',since)
    .lte('measured_at',new Date(timeOf(anchor)+60000).toISOString())
    .order('measured_at',{ascending:true})
    .limit(5000);
  if(runId) rangeQuery=rangeQuery.eq('run_id',runId);
  const {data,error}=await rangeQuery;
  if(error) throw error;
  const readings=data||[];
  drawChart(readings);
  recentEvents(readings);
  $('#plant-chart-note').textContent=`${readings.length.toLocaleString()} current-run readings${runId?' · '+runId:''}`;

  const newest=readings.at(-1)||anchor;
  const six=readingNear(readings,6,newest);
  const twelve=readingNear(readings,12,newest);
  const sixSlope=slopePerDay(windowReadings(readings,6,newest));
  const twelveSlope=slopePerDay(windowReadings(readings,12,newest));
  showDryDown('#plant-6h-change',six&&sixSlope!==null?sixSlope:null);
  showDryDown('#plant-12h-change',twelve&&twelveSlope!==null?twelveSlope:null);
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
    supabase.from('readings').select('weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1),
    supabase.from('device_reading_summary').select('*').eq('device_id',device.id).limit(1)
  ]);
  const latest=latestRows?.[0]||null, summary=summaryRows?.[0]||null;
  let recentRangeRows=[];
  if(latest){
    let recentRangeQuery=supabase.from('readings')
      .select('weight_g,measured_at,created_at,run_id')
      .eq('device_id',device.id)
      .order('measured_at',{ascending:false,nullsFirst:false})
      .order('created_at',{ascending:false})
      .limit(72);
    if(latest.run_id) recentRangeQuery=recentRangeQuery.eq('run_id',latest.run_id);
    const {data:recentRows}=await recentRangeQuery;
    recentRangeRows=recentRows||[];
  }
  let runSummary=null;
  if(latest?.run_id){
    const {data:runRows}=await supabase.from('device_run_summary')
      .select('*')
      .eq('device_id',device.id)
      .eq('run_id',latest.run_id)
      .limit(1);
    runSummary=runRows?.[0]||null;
  }
  const fresh=stampOf(latest)&&(Date.now()-new Date(stampOf(latest)).getTime()<90*60000);
  const maintenance=p.status==='offline'||device.status==='maintenance';
  $('#plant-status').textContent=maintenance?'Maintenance':fresh?'Connected':'Last seen '+ageLabel(stampOf(latest));
  $('#plant-status').className='status '+(maintenance?'offline':fresh?'good':'learning');
  if(maintenance){
    $('#plant-summary').textContent=`${plantName(p)} is currently offline while ${device.device_code} is awaiting an electronics rebuild. Historical readings remain available below.`;
  }
  $('#plant-weight').textContent=latest?fmt(latest.weight_g)+' g':'—';
  $('#plant-temperature').textContent=latest?fmt(latest.temperature_c)+' °C':'—';
  $('#plant-reading-count').textContent=Number(runSummary?.reading_count||summary?.reading_count||0).toLocaleString();
  if(!maintenance){
    $('#plant-summary').textContent=`${plantName(p)} is linked to ${device.device_code}. This page is now using its recorded weight and temperature history.`;
  }

  const recentWeights=recentRangeRows
    .map(r=>Number(r.weight_g))
    .filter(Number.isFinite)
    .sort((a,b)=>a-b);
  let low=null,high=null;
  if(recentWeights.length>=8){
    const pct=q=>{
      const i=(recentWeights.length-1)*q;
      const lo=Math.floor(i),hi=Math.ceil(i),f=i-lo;
      return recentWeights[lo]*(1-f)+recentWeights[hi]*f;
    };
    low=pct(.05);
    high=pct(.95);
  }else if(recentWeights.length){
    low=recentWeights[0];
    high=recentWeights.at(-1);
  }
  const current=Number(latest?.weight_g);
  if(Number.isFinite(low)&&Number.isFinite(high)&&high>low&&Number.isFinite(current)){
    const percent=Math.max(0,Math.min(100,((current-low)/(high-low))*100));
    const gauge=$('#radial-gauge');
    gauge.style.setProperty('--level',percent.toFixed(1));
    gauge.style.setProperty('--angle',(percent*3.6).toFixed(1)+'deg');
    $('#range-percent').textContent=Math.round(percent)+'%';
    $('#range-low-side').textContent=low.toFixed(1)+' g';
    $('#range-high-side').textContent=high.toFixed(1)+' g';

    const state=percent<15?'Very dry relative to recent range':
      percent<35?'Dry side of recent range':
      percent<75?'Mid-range moisture position':
      'Near the wet end of recent range';
    $('#plant-action-title').textContent=state+'.';
    $('#plant-action-copy').textContent=`Current weight is ${Math.round(percent)}% through the recent 72-reading range (${recentRangeRows.length} readings). Orange/yellow marks the dry end, green the middle zone, and dark blue the saturated end. This is descriptive, not yet a watering recommendation.`;
  }

  const count=Number(runSummary?.reading_count||summary?.reading_count||0);
  $('#plant-intelligence-title').textContent='Learning '+plantName(p)+'.';
  $('#plant-intelligence-copy').textContent=`Sykerbos has ${count.toLocaleString()} readings in the active run${latest?.run_id?' ('+latest.run_id+')':''} from ${device.device_code}. Historical runs remain stored separately for comparison.`;
  $('#plant-learning-bar').style.width=Math.min(100,Math.round(count/20))+'%';
  $('#plant-learning-note').textContent=count.toLocaleString()+' recorded readings';

  const rangeButtons=[...document.querySelectorAll('.range-pills button')];
  const hoursFor={'24h':24,'7d':168,'30d':720};
  rangeButtons.forEach(button=>button.addEventListener('click',async()=>{
    rangeButtons.forEach(b=>b.classList.toggle('active',b===button));
    await loadRange(device.id,hoursFor[button.textContent.trim()]||24,latest?.run_id||null);
  }));
  await loadRange(device.id,24,latest?.run_id||null);
}

init();
