import { supabase } from './supabase-client.js';
import { plantAssetFor } from './plant-assets.js';
import { reserveState, reserveMarkup } from './water-reserve.js?v=1';

const $=selector=>document.querySelector(selector);
const fmt=(value,digits=1)=>{
  const n=Number(value);
  return Number.isFinite(n)?n.toFixed(digits):'—';
};
const stampOf=r=>r?.measured_at||r?.created_at||null;
const readingTime=r=>new Date(stampOf(r)||0).getTime();
const plantLabel=p=>p.nickname||p.common_name||'Unnamed plant';
const speciesLabel=p=>[p.common_name,p.botanical_name].filter(Boolean).join(' · ');
const imageFor=p=>plantAssetFor(p);

function setImage(el,plant){
  const image=imageFor(plant);
  if(image){
    el.style.backgroundImage=`url("${image.image}")`;
    el.style.backgroundPosition='center';
    el.classList.add('has-image');
  }else{
    el.style.backgroundImage='none';
    el.classList.remove('has-image');
    el.dataset.fallback=(plant.common_name||plant.nickname||'Plant').slice(0,1).toUpperCase();
  }
}

function formatAge(dateString){
  if(!dateString) return 'No readings yet';
  const diff=Math.max(0,Date.now()-new Date(dateString).getTime());
  const mins=Math.round(diff/60000);
  if(mins<2) return 'just now';
  if(mins<60) return `${mins} min ago`;
  const hours=Math.round(mins/60);
  if(hours<48) return `${hours} h ago`;
  return `${Math.round(hours/24)} d ago`;
}

function findReadingNear(readings,hoursAgo,anchorReading,toleranceMinutes=75){
  if(!readings?.length||!anchorReading) return null;
  const target=readingTime(anchorReading)-hoursAgo*3600000;
  let best=null;
  let bestDiff=Infinity;
  for(const r of readings){
    const diff=Math.abs(readingTime(r)-target);
    if(diff<bestDiff){best=r;bestDiff=diff;}
  }
  return bestDiff<=toleranceMinutes*60000?best:null;
}

function changeBetween(oldReading,newReading){
  const a=Number(oldReading?.weight_g), b=Number(newReading?.weight_g);
  if(!Number.isFinite(a)||!Number.isFinite(b)) return null;
  return b-a;
}

function slopePerDay(readings){
  const pts=(readings||[])
    .filter(r=>Number.isFinite(Number(r.weight_g))&&stampOf(r))
    .map(r=>({x:readingTime(r)/1000,y:Number(r.weight_g)}));
  if(pts.length<3) return null;
  const mx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
  const my=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  const num=pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
  const den=pts.reduce((s,p)=>s+(p.x-mx)*(p.x-mx),0);
  return den?num/den*86400:null;
}

function windowReadings(readings,hours,anchor){
  if(!anchor) return [];
  const cutoff=readingTime(anchor)-hours*3600000;
  return (readings||[]).filter(r=>readingTime(r)>=cutoff&&readingTime(r)<=readingTime(anchor));
}

function buildChart(readings){
  const host=$('#real-chart');
  if(!host) return;
  const points=(readings||[])
    .filter(r=>Number.isFinite(Number(r.weight_g)) && stampOf(r))
    .sort((a,b)=>readingTime(a)-readingTime(b));

  if(points.length<2){
    host.innerHTML='<div class="chart-loading">Not enough weight readings to draw a trend yet.</div>';
    return;
  }

  const values=points.map(r=>Number(r.weight_g));
  const min=Math.min(...values), max=Math.max(...values);
  const range=Math.max(1,max-min);
  const width=800,height=230,pad=18;

  const coords=points.map((r,i)=>{
    const x=pad+(i/(points.length-1))*(width-pad*2);
    const y=pad+((max-Number(r.weight_g))/range)*(height-pad*2);
    return [x,y];
  });
  const path=coords.map(([x,y],i)=>(i?'L':'M')+`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  host.innerHTML=`
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Seven-day weight history">
      <line x1="${pad}" y1="${pad}" x2="${width-pad}" y2="${pad}" class="chart-grid-line"/>
      <line x1="${pad}" y1="${height/2}" x2="${width-pad}" y2="${height/2}" class="chart-grid-line"/>
      <line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" class="chart-grid-line"/>
      <path d="${path}" class="live-chart-path"/>
    </svg>
    <span class="chart-axis top">${max.toFixed(0)} g</span>
    <span class="chart-axis bottom">${min.toFixed(0)} g</span>
    <span class="chart-label start">7 days ago</span>
    <span class="chart-label end">Now</span>`;
}

function plantReserve(p){
  const stamp=stampOf(p.latest);
  const age=stamp?Date.now()-new Date(stamp).getTime():Infinity;
  const fresh=Number.isFinite(age)&&age>=-60000&&age<90*60000;
  const valid=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
  const learned=valid(p.learned_dry_g)&&valid(p.learned_saturated_g)&&Number(p.learned_saturated_g)>Number(p.learned_dry_g);
  return reserveState({weight:p.latest?.weight_g,dry:learned?p.learned_dry_g:p.provisional_dry_g,wet:learned?p.learned_saturated_g:p.provisional_saturated_g,fresh,maintenance:p.status==='offline'||p.device?.status==='maintenance',provisional:!learned});
}

function renderPlantCards(plants){
  const host=$('#plant-list');
  if(!host) return;

  const secondary=plants
    .filter(p=>!p.is_primary)
    .sort((a,b)=>{
      const aDown=(a.status==='offline'||a.device?.status==='maintenance')?1:0;
      const bDown=(b.status==='offline'||b.device?.status==='maintenance')?1:0;
      if(aDown!==bDown) return aDown-bDown;
      return (a.display_order??0)-(b.display_order??0);
    });
  const cards=secondary.map(p=>{
    const r=p.latest;
    const age=formatAge(stampOf(r));
    const fresh=stampOf(r) && (Date.now()-new Date(stampOf(r)).getTime()<90*60000);
    const maintenance=p.status==='offline'||p.device?.status==='maintenance';
    const image=imageFor(p);
    const bg=image?`style="background-image:url('${image.image}');background-position:${'center'}"`:'';
    const cls=image?'plant-thumb herbarium-thumb has-image':'plant-thumb herbarium-thumb';
    const fallback=!image?(p.common_name||p.nickname||'P').slice(0,1).toUpperCase():'';
    const reserve=plantReserve(p);
    const stateLabel=maintenance?'Maintenance':fresh?'Connected':'Last seen '+age;
    const stateClass=maintenance?'offline':fresh?'good':'learning';
    return `<a class="plant-collection-card ${maintenance?'offline-card':''}" href="plant.html?plant=${encodeURIComponent(p.id)}" data-plant-id="${p.id}">
      <div class="${cls}" ${bg} data-fallback="${fallback}"></div>
      <div class="plant-collection-copy">
        <span class="status ${stateClass}">${stateLabel}</span>
        <h3>${plantLabel(p)}</h3>
        <p>${speciesLabel(p)||p.device?.device_code||'Plant'}</p>
        ${reserveMarkup(reserve)}
        <p class="card-next-action">${reserve.action}</p>
        <small class="card-freshness">${stampOf(r)?'Updated '+age:'No readings yet'}</small>
        <div class="mini-reading"><strong>${fmt(r?.weight_g)} g</strong><span>${fmt(r?.temperature_c)} °C</span></div>
        <small>${p.device?.device_code||''} · ${maintenance?'Electronics rebuild pending':Number(p.reading_count||0).toLocaleString()+' current-run readings'}</small>
      </div>
    </a>`;
  });

  cards.push(`<a class="plant-collection-card add-plant-card" href="start.html?new=1">
    <div class="add-circle">+</div>
    <div class="plant-collection-copy"><h3>Add another plant</h3><p>Connect another VyTile and expand your collection.</p></div>
  </a>`);

  host.innerHTML=cards.join('');
}

async function loadPlantData(user){
  const {data:plants,error}=await supabase
    .from('plants')
    .select('id,device_id,nickname,common_name,botanical_name,status,is_primary,display_order,learned_dry_g,learned_saturated_g,provisional_dry_g,provisional_saturated_g')
    .eq('user_id',user.id)
    .order('is_primary',{ascending:false})
    .order('display_order',{ascending:true});

  if(error) throw error;
  if(!plants?.length){
    $('#primary-plant-name').textContent='Set up your first plant';
    $('#primary-summary').textContent='Your VyTiles are claimed. Tell Sykerbos what is sitting on each one.';
    $('#plant-list').innerHTML='<a class="plant-collection-card add-plant-card" href="plant-setup.html"><div class="add-circle">+</div><div><h3>Assign plants to VyTiles</h3><p>Create your real plant records.</p></div></a>';
    return;
  }

  const deviceIds=plants.map(p=>p.device_id).filter(Boolean);
  const {data:devices}=await supabase.from('devices').select('id,device_code,model,status').in('id',deviceIds);
  const deviceMap=new Map((devices||[]).map(d=>[d.id,d]));

  const enriched=[];
  for(const plant of plants){
    const device=deviceMap.get(plant.device_id)||null;
    let latest=null,readingCount=0;
    if(device){
      const [{data:latestRows},{count}]=await Promise.all([
        supabase.from('readings')
          .select('weight_g,temperature_c,measured_at,created_at,run_id')
          .eq('device_id',device.id)
          .order('measured_at',{ascending:false,nullsFirst:false})
          .order('created_at',{ascending:false})
          .limit(1),
        supabase.from('readings')
          .select('id',{count:'exact',head:true})
          .eq('device_id',device.id)
      ]);
      latest=latestRows?.[0]||null;
      readingCount=count||0;
    }
    enriched.push({...plant,device,latest,reading_count:readingCount});
  }

  const primary=enriched.find(p=>p.is_primary)||enriched[0];
  renderPlantCards(enriched);

  $('#primary-plant-name').textContent=plantLabel(primary);
  $('#primary-species').textContent=speciesLabel(primary)||primary.device?.device_code||'Your main plant';
  setImage($('#primary-herbarium-image'),primary);

  const reserve=plantReserve(primary);
  $('#primary-water-reserve').innerHTML=reserveMarkup(reserve);
  $('#primary-next-action').textContent=reserve.action;
  const latest=primary.latest;
  const latestStamp=stampOf(latest);
  const isFresh=latestStamp && (Date.now()-new Date(latestStamp).getTime()<90*60000);
  $('#primary-status').textContent=isFresh?'Connected':'Last seen '+formatAge(latestStamp);
  $('#primary-status').className='status '+(isFresh?'good':'learning');
  $('#live-weight').textContent=latest?fmt(latest.weight_g)+' g':'—';
  $('#live-temp').textContent=latest?fmt(latest.temperature_c)+' °C':'—';
  $('#temp-status').textContent=latest?'Latest VyTile reading':'Waiting for weight data';
  $('#live-reading-label').textContent=latestStamp?'Updated '+formatAge(latestStamp):'No reading yet';
  $('#reading-count').textContent=Number(primary.reading_count||0).toLocaleString();
  $('#reading-count-note').textContent=primary.latest?.run_id||primary.device?.device_code||'This plant';

  $('#device-heading').textContent=primary.device?`${primary.device.device_code} · ${isFresh?'Online':'Not currently reporting'}`:'No VyTile assigned';
  $('#device-meta').textContent=primary.device?`${primary.device.model} · ${plantLabel(primary)}`:'Use Plant + device setup';

  if(!primary.device) return;

  const anchorTime=readingTime(primary.latest);
  const since=new Date(anchorTime-7*86400000).toISOString();
  let historyQuery=supabase
    .from('readings')
    .select('weight_g,temperature_c,measured_at,created_at,run_id')
    .eq('device_id',primary.device.id)
    .gte('measured_at',since)
    .lte('measured_at',new Date(anchorTime+60000).toISOString())
    .order('measured_at',{ascending:true})
    .limit(1000);
  if(primary.latest?.run_id) historyQuery=historyQuery.eq('run_id',primary.latest.run_id);
  const {data:history,error:historyError}=await historyQuery;

  if(historyError || !history?.length){
    $('#primary-summary').textContent='Sykerbos has this plant connected, but there is not enough recent history to summarize yet.';
    return;
  }

  buildChart(history);
  const firstRunStamp=stampOf(history[0]), lastRunStamp=stampOf(history.at(-1));
  const runHours=firstRunStamp&&lastRunStamp?Math.max(0,(new Date(lastRunStamp)-new Date(firstRunStamp))/3600000):0;
  $('#chart-note').textContent=`${history.length.toLocaleString()} readings from current run ${primary.latest?.run_id||''} · ${runHours.toFixed(1)} h of data`;

  const newest=history[history.length-1];
  const six=findReadingNear(history,6,newest);
  const twelve=findReadingNear(history,12,newest);
  const sixChange=changeBetween(six,newest);
  const twelveChange=changeBetween(twelve,newest);
  const sixSlope=slopePerDay(windowReadings(history,6,newest));
  const twelveSlope=slopePerDay(windowReadings(history,12,newest));

  if(sixSlope!==null&&sixChange!==null){
    $('#six-hour-rate').textContent=(sixSlope<0?Math.abs(sixSlope).toFixed(1):'+'+sixSlope.toFixed(1))+' g/day';
    $('#six-hour-note').textContent=(sixSlope<0?'Net '+sixChange.toFixed(1)+' g over 6 h':'Mass rising · net +'+sixChange.toFixed(1)+' g');
  }else{
    $('#six-hour-rate').textContent='—';
    $('#six-hour-note').textContent='Not enough continuous data';
  }
  if(twelveSlope!==null&&twelveChange!==null){
    $('#twelve-hour-change').textContent=(twelveSlope<0?Math.abs(twelveSlope).toFixed(1):'+'+twelveSlope.toFixed(1))+' g/day';
    $('#twelve-hour-note').textContent=(twelveSlope<0?'Net '+twelveChange.toFixed(1)+' g over 12 h':'Mass rising · net +'+twelveChange.toFixed(1)+' g');
  }else{
    $('#twelve-hour-change').textContent='—';
    $('#twelve-hour-note').textContent='Not enough continuous data';
  }

  const direction= sixChange===null ? 'building a baseline' :
    sixChange<0 ? 'currently losing weight between readings' :
    sixChange>0 ? 'shows a recent weight increase, likely an irrigation or handling event' :
    'is currently very stable';

  $('#primary-summary').textContent=`${plantLabel(primary)} ${direction}. Sykerbos has ${Number(primary.reading_count||0).toLocaleString()} readings in the active run on ${primary.device.device_code}.`;

  $('#intelligence-title').textContent=`Learning ${plantLabel(primary)}.`;
  $('#intelligence-copy').textContent=`This view uses the active telemetry run (${primary.latest?.run_id||'current run'}) rather than mixing older experiments with the live plant. Irrigation recognition and predictions come next.`;
  const progress=Math.min(100,Math.round((Number(primary.reading_count||0)/72)*100));
  $('#learning-progress-bar').style.width=progress+'%';
  $('#learning-progress-note').textContent=`${Number(primary.reading_count||0).toLocaleString()} current-run readings · ${Number(primary.lifetime_reading_count||0).toLocaleString()} lifetime stored`;
}

async function init(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){ location.replace('account.html'); return; }

  const user=session.user;
  const isGuest=Boolean(user.is_anonymous);
  const profileButton=$('#profile-button');
  profileButton.textContent=isGuest?'G':(user.email||'S').slice(0,2).toUpperCase();
  profileButton.title=isGuest?'Guest session':(user.email||'Sykerbos account');

  const {data:links}=await supabase.from('user_devices').select('device_id').eq('user_id',user.id);
  if(links?.length) $('#alpha-claim')?.remove();

  try{
    await loadPlantData(user);
  }catch(error){
    console.error(error);
    $('#primary-plant-name').textContent='Could not load your plants';
    $('#primary-summary').textContent='Please refresh the page and try again.';
  }
}

$('#profile-button')?.addEventListener('click',async()=>{
  if(confirm('Sign out of Sykerbos on this device?')){
    await supabase.auth.signOut();
    location.href='account.html';
  }
});

document.querySelectorAll('.recommendation-grid button').forEach(button=>{
  button.addEventListener('click',()=>{
    const saved=button.dataset.saved==='true';
    button.dataset.saved=String(!saved);
    button.textContent=saved?'♡ Want to grow':'♥ Saved';
  });
});

init();
