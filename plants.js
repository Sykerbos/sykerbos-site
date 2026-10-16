import { supabase } from './supabase-client.js';
import { plantAssetFor } from './plant-assets.js';

const $=s=>document.querySelector(s);
const stampOf=r=>r?.measured_at||r?.created_at||null;
const t=r=>new Date(stampOf(r)||0).getTime();
const fmt=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const plantName=p=>p.nickname||p.common_name||'Unnamed plant';
const species=p=>[p.common_name,p.botanical_name].filter(Boolean).join(' · ');

function ageLabel(ts){
  if(!ts)return 'No readings';
  const m=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/60000));
  if(m<2)return 'just now'; if(m<60)return m+' min ago';
  const h=Math.round(m/60); if(h<48)return h+' h ago';
  return Math.round(h/24)+' d ago';
}
function slope(readings){
  const pts=(readings||[]).filter(r=>Number.isFinite(Number(r.weight_g))&&stampOf(r)).map(r=>({x:t(r)/1000,y:Number(r.weight_g)}));
  if(pts.length<3)return null;
  const mx=pts.reduce((s,p)=>s+p.x,0)/pts.length,my=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  const den=pts.reduce((s,p)=>s+(p.x-mx)*(p.x-mx),0);
  if(!den)return null;
  return pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/den*86400;
}
async function load(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.replace('account.html');return;}
  const {data:plants,error}=await supabase.from('plants').select('*').eq('user_id',session.user.id).order('display_order',{ascending:true});
  if(error)throw error;
  if(!plants?.length){
    $('#plants-collection-grid').innerHTML='<a class="add-plant-tile" href="start.html?new=1"><div><strong>Add your first plant</strong><p>Connect a VyTile to begin.</p></div></a>';
    $('#collection-count').textContent='0';$('#online-count').textContent='0';$('#attention-count').textContent='0';return;
  }
  const ids=plants.map(p=>p.device_id).filter(Boolean);
  const {data:devices}=ids.length?await supabase.from('devices').select('*').in('id',ids):{data:[]};
  const dm=new Map((devices||[]).map(d=>[d.id,d]));
  const enriched=[];
  for(const p of plants){
    const device=dm.get(p.device_id)||null;
    let latest=null,rate=null;
    if(device){
      const {data:rows}=await supabase.from('readings').select('weight_g,temperature_c,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(40);
      const ordered=[...(rows||[])].sort((a,b)=>t(a)-t(b));
      latest=ordered.at(-1)||null;
      const anchor=t(latest), twelve=ordered.filter(r=>t(r)>=anchor-12*3600000);
      rate=slope(twelve);
    }
    enriched.push({...p,device,latest,rate});
  }
  const online=enriched.filter(p=>stampOf(p.latest)&&Date.now()-new Date(stampOf(p.latest)).getTime()<90*60000&&p.status!=='offline'&&p.device?.status!=='maintenance').length;
  const attention=enriched.length-online;
  const movers=enriched.filter(p=>Number.isFinite(p.rate)).sort((a,b)=>Math.abs(b.rate)-Math.abs(a.rate));
  $('#collection-count').textContent=enriched.length;
  $('#online-count').textContent=online;
  $('#attention-count').textContent=attention;
  if(movers[0]){
    $('#fastest-mover').textContent=plantName(movers[0]);
    $('#fastest-mover-note').textContent=Math.abs(movers[0].rate).toFixed(1)+' g/day today';
  }

  const cards=enriched.sort((a,b)=>{
    if(a.is_primary!==b.is_primary)return a.is_primary?-1:1;
    const ad=(a.status==='offline'||a.device?.status==='maintenance')?1:0;
    const bd=(b.status==='offline'||b.device?.status==='maintenance')?1:0;
    return ad-bd;
  }).map(p=>{
    const asset=plantAssetFor(p),fresh=stampOf(p.latest)&&Date.now()-new Date(stampOf(p.latest)).getTime()<90*60000;
    const maintenance=p.status==='offline'||p.device?.status==='maintenance';
    const cls=maintenance?'offline':fresh?'good':'learning';
    const label=maintenance?'Maintenance':fresh?'Connected':'Last seen '+ageLabel(stampOf(p.latest));
    const bg=asset?' style="background-image:url(\''+asset.image+'\')"':'';
    const fallback=(p.common_name||p.nickname||'P').slice(0,1).toUpperCase();
    return '<a class="plant-tile" href="plant.html?plant='+encodeURIComponent(p.id)+'">'+
      '<div class="plant-tile-image '+(asset?'has-image':'')+'"'+bg+' data-fallback="'+fallback+'"></div>'+
      '<div class="plant-tile-body">'+
        '<span class="status '+cls+'">'+label+'</span>'+(p.is_primary?'<span class="primary-badge">Main plant</span>':'')+
        '<h3>'+plantName(p)+'</h3><p>'+(species(p)||'Your plant')+'</p>'+
        '<div class="tile-readings">'+
          '<div><small>Weight</small><strong>'+fmt(p.latest?.weight_g)+' g</strong></div>'+
          '<div><small>Temp</small><strong>'+fmt(p.latest?.temperature_c)+' °C</strong></div>'+
          '<div><small>Use</small><strong>'+(Number.isFinite(p.rate)?Math.abs(p.rate).toFixed(1)+' g/d':'—')+'</strong></div>'+
        '</div>'+
        '<div class="tile-device-row"><span>'+(p.device?.device_code||'No VyTile')+'</span><span>'+(maintenance?'Offline':ageLabel(stampOf(p.latest)))+'</span></div>'+
      '</div></a>';
  }).join('');
  $('#plants-collection-grid').innerHTML=cards+'<a class="add-plant-tile" href="start.html?new=1"><div><strong>+ Add another plant</strong><p>Connect another VyTile and expand your collection.</p></div></a>';
}
load();