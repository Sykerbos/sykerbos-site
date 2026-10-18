import { supabase } from './supabase-client.js';
import { plantAssetFor } from './plant-assets.js';
import { reserveState, reserveMarkup } from './water-reserve.js?v=1';
import { irrigationState } from './irrigation-state.js?v=1';

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

function buildChart(readings,refill=null){
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
    const span=Math.max(1,readingTime(points.at(-1))-readingTime(points[0]));
    const x=pad+((readingTime(r)-readingTime(points[0]))/span)*(width-pad*2);
    const y=pad+((max-Number(r.weight_g))/range)*(height-pad*2);
    return [x,y];
  });
  const refillIndex=refill?points.findIndex(r=>readingTime(r)===refill.at):-1;
  const marker=refillIndex>=0?`<line x1="${coords[refillIndex][0]}" y1="${pad}" x2="${coords[refillIndex][0]}" y2="${height-pad}" stroke="#b63969" stroke-dasharray="4 4"/><circle cx="${coords[refillIndex][0]}" cy="${coords[refillIndex][1]}" r="5" fill="#b63969"/><text x="${Math.min(width-65,Math.max(20,coords[refillIndex][0]-45))}" y="${pad+14}" fill="#753a51" font-size="13">Refill</text>`:'';
  const path=coords.map(([x,y],i)=>(i?'L':'M')+`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  host.innerHTML=`
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Seven-day weight history">
      <line x1="${pad}" y1="${pad}" x2="${width-pad}" y2="${pad}" class="chart-grid-line"/>
      <line x1="${pad}" y1="${height/2}" x2="${width-pad}" y2="${height/2}" class="chart-grid-line"/>
      <line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" class="chart-grid-line"/>
      <path d="${path}" class="live-chart-path"/>${marker}
    </svg>
    <span class="chart-axis top">${max.toFixed(0)} g</span>
    <span class="chart-axis bottom">${min.toFixed(0)} g</span>
    <span class="chart-label start">${formatAge(stampOf(points[0]))}</span>
    <span class="chart-label end">Latest reading</span>`;
}

function plantReserve(p){
  const stamp=stampOf(p.latest);
  const age=stamp?Date.now()-new Date(stamp).getTime():Infinity;
  const fresh=Number.isFinite(age)&&age>=-60000&&age<90*60000;
  const valid=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
  const learned=valid(p.learned_dry_g)&&valid(p.learned_saturated_g);
  const state=reserveState({weight:p.latest?.weight_g,dry:p.learned_dry_g??p.provisional_dry_g,wet:p.learned_saturated_g??p.provisional_saturated_g,fresh,maintenance:p.status==='offline'||p.device?.status==='maintenance',provisional:!learned});
  if(p.cycle?.recent&&state.percent!==null&&state.kind!=='offline')return {...state,label:'Recently watered',action:p.cycle.settling?'Watered recently. Let the pot settle.':'Following the new dry-down.',note:'Refill inferred from weight history'};
  return state;
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
    let latest=null;
    if(device){
      const {data:latestRows,error:latestError}=await supabase.from('readings')
        .select('weight_g,temperature_c,measured_at,created_at,run_id')
        .eq('device_id',device.id)
        .order('measured_at',{ascending:false,nullsFirst:false})
        .order('created_at',{ascending:false}).limit(1);
      if(latestError)throw latestError;
      latest=latestRows?.[0]||null;
    }
    let recent=[],activeCount=0;
    if(device&&latest){
      let recentQuery=supabase.from('readings').select('weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(72);
      let countQuery=supabase.from('readings').select('id',{count:'exact',head:true}).eq('device_id',device.id);
      if(latest.run_id){recentQuery=recentQuery.eq('run_id',latest.run_id);countQuery=countQuery.eq('run_id',latest.run_id);}
      else{recentQuery=recentQuery.is('run_id',null);countQuery=countQuery.is('run_id',null);}
      const [historyResult,countResult]=await Promise.all([recentQuery,countQuery]);
      recent=historyResult.data||[];activeCount=countResult.count||0;
    }
    const cycle=irrigationState(recent,{dry:plant.learned_dry_g??plant.provisional_dry_g,wet:plant.learned_saturated_g??plant.provisional_saturated_g});
    enriched.push({...plant,device,latest,cycle,reading_count:activeCount});
  }

  await renderDashboard(enriched);
}

async function renderDashboard(enriched,historyRows=null){
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

  let history=historyRows,historyError=null;
  if(!history){
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
  else historyQuery=historyQuery.is('run_id',null);
  ({data:history,error:historyError}=await historyQuery);
  }

  if(historyError || !history?.length){
    for(const id of ['#six-hour-rate','#twelve-hour-change'])$(id).textContent='Learning';
    for(const id of ['#six-hour-note','#twelve-hour-note'])$(id).textContent='History unavailable';
    $('#primary-summary').textContent='Sykerbos has this plant connected, but there is not enough recent history to summarize yet.';
    return;
  }

  const cycle=irrigationState(history,{dry:primary.learned_dry_g??primary.provisional_dry_g,wet:primary.learned_saturated_g??primary.provisional_saturated_g});
  primary.cycle=cycle;
  const eventReserve=plantReserve(primary);
  $('#primary-water-reserve').innerHTML=reserveMarkup(eventReserve);
  $('#primary-next-action').textContent=eventReserve.action;
  buildChart(history,cycle.refill);
  $('#chart-note').textContent=`${history.length.toLocaleString()} readings in ${primary.latest?.run_id||'the current run'}${cycle.refill?' · refill marked on chart':''}`;
  for(const [hours,result,valueId,noteId] of [[6,cycle.six,'#six-hour-rate','#six-hour-note'],[12,cycle.twelve,'#twelve-hour-change','#twelve-hour-note']]){
    $(valueId).textContent=result.rate===null?'Learning':result.rate.toFixed(1)+' g/day';
    $(noteId).textContent=result.rate!==null?`Measured over ${hours} h${cycle.refill?' after watering':''}`:result.reason==='refill'?'Rebuilding after watering':result.reason==='handling'?'Waiting after a weight change':result.reason==='settling'?'Weight is still settling':'Waiting for a continuous window';
  }
  const freshEvent=cycle.recent&&eventReserve.kind!=='offline';
  if(freshEvent){
    $('#primary-summary').textContent=`A refill was detected around ${new Date(cycle.refill.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}. Dry-down rates restart after watering.`;
    $('#intelligence-title').textContent=cycle.settling?'Watching the refill.':'Learning the new dry-down.';
    $('#intelligence-copy').textContent=`Pot weight increased by about ${cycle.refill.gain.toFixed(0)} g. Earlier dry-down readings are excluded from the new 6- and 12-hour rates. Drainage and handling can also change weight.`;
  }else{
    $('#primary-summary').textContent=cycle.six.rate!==null?`${plantLabel(primary)} is using about ${cycle.six.rate.toFixed(1)} g/day over its latest uninterrupted 6-hour window.`:'Watching for a continuous dry-down between watering and handling events.';
    $('#intelligence-title').textContent=`Learning ${plantLabel(primary)}.`;
    $('#intelligence-copy').textContent='Refills and large handling changes restart the dry-down calculation. Rates use uninterrupted readings from this measurement run.';
  }
  const progress=Math.min(100,Math.round(cycle.segment.length/36*100));
  $('#learning-progress-bar').style.width=progress+'%';
  $('#learning-progress-note').textContent=`${cycle.segment.length.toLocaleString()} readings in this uninterrupted dry-down`;

}

async function init(){
  if(new URLSearchParams(location.search).get('demo')==='watering'){
    $('#dashboard-demo-notice').hidden=false;$('#profile-button').textContent='D';$('#profile-button').title='Simulated dashboard';
    const now=Date.now(),history=Array.from({length:75},(_,i)=>({weight_g:i<72?540-(i*.09):640.3-(i-72)*.15,temperature_c:22.7,measured_at:new Date(now-(74-i)*20*60000).toISOString(),run_id:'DEMO-REFILL'}));
    const plant={id:'demo',nickname:'Pot A',common_name:'Valencia Orange Seedling',botanical_name:'Citrus × sinensis',is_primary:true,learned_saturated_g:640,provisional_dry_g:525,device:{id:'demo',device_code:'DemoTile',model:'Example tile'},latest:history.at(-1),reading_count:history.length,lifetime_reading_count:history.length};
    plant.cycle=irrigationState(history,{dry:525,wet:640});await renderDashboard([plant],history);return;
  }
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
    let refreshing=false;
    const refresh=async()=>{if(refreshing||document.hidden)return;refreshing=true;try{await loadPlantData(user);}catch(error){console.error('Dashboard refresh failed',error);}finally{refreshing=false;}};
    const timer=setInterval(refresh,60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  }catch(error){
    console.error(error);
    $('#primary-plant-name').textContent='Could not load your plants';
    $('#primary-summary').textContent='Please refresh the page and try again.';
  }
}

$('#profile-button')?.addEventListener('click',async()=>{
  if(new URLSearchParams(location.search).get('demo')==='watering')return;
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
