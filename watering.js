import {waterPlan,recentLossRate,numberOrNull,localReadingUrl,directSample} from './watering-model.js?v=1';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),demo=params.get('demo')==='1';
let current=null,dry=null,wet=null,deviceCode='',running=false,baseline=null,lastWeight=null,lastSampleAt=0,lastSequence=-1,endpoint=null,pollTimer=null,controller=null,connected=false,storageKey=null;
const amount=$('#target-amount'),rate=$('#daily-rate');
const fmt=(v,d=1)=>v===null||!Number.isFinite(v)?'—':v.toFixed(d);
function message(text,bad=false){$('#connection-state').textContent=text;$('#connection-state').className='connection-state'+(bad?' stale':connected?' connected':'');}
function fresh(){return connected&&(demo||Date.now()-lastSampleAt<3000);}
function updatePlan(){
  const addition=numberOrNull(amount.value),loss=numberOrNull(rate.value),start=running?baseline:current;
  const plan=waterPlan({current:start,addition,dry,wet,rate:loss});
  $('#target-weight').textContent=plan.target===null?'—':fmt(plan.target)+' g';
  $('#projected-days').textContent=plan.days===null?'Learning':'~'+fmt(plan.days)+' days';
  $('#projection-note').textContent=plan.days===null?'Set a daily water-use assumption to explore reserve time. Wet and dry references must also be available.':`Scenario: ${fmt(plan.reserve)} g above the dry reference, at ${fmt(loss)} g/day. This is an estimate, not a confirmed watering forecast.`;
  $('#wet-warning').hidden=plan.overWet<=0;
  $('#wet-warning').textContent=`This target is ${fmt(plan.overWet)} g above the saved wet reference. Extra water may drain away; projected reserve time is capped at that reference.`;
  const valid=addition!==null&&addition>0&&addition<=50000;
  amount.setAttribute('aria-invalid',String(!valid&&amount.value!==''));
  $('#start-watering').disabled=running||!fresh()||!valid;
  $('#end-watering').disabled=!running;
  document.querySelectorAll('[data-add]').forEach(b=>b.disabled=!running);
  if(running&&lastWeight!==null){
    const gained=Math.max(0,lastWeight-baseline),remaining=Math.max(0,addition-gained);
    $('#added-weight').textContent=fmt(gained)+' g';$('#remaining-weight').textContent=fmt(remaining)+' g';
    $('#water-progress').value=Math.min(100,gained/addition*100);
    document.querySelector('.live-panel').classList.toggle('target-reached',gained>=addition);
    if(fresh())$('#pour-message').textContent=gained>=addition?'Target reached. Stop pouring and allow drainage.':remaining<=10?'Nearly there. Pour slowly and let the reading settle.':'Water slowly while watching the weight gain.';
  }
  if(storageKey&&!running&&valid){try{localStorage.setItem(storageKey,amount.value);}catch{}}
}
function receive(weight){
  lastWeight=weight;lastSampleAt=Date.now();connected=true;
  if(!running)current=weight;
  $('#live-weight').textContent=fmt(weight);
  message(demo?'Simulated device · example':'Direct from '+deviceCode);
  $('#sample-age').textContent=demo?'Simulated weight. Use the example controls below.':'Fresh device sample · updates about once a second';
  if(!running)$('#pour-message').textContent='Keep the pot still, then start to capture its starting weight.';
  updatePlan();
}
function disconnect(text='Not connected to VyTile'){
  clearTimeout(pollTimer);pollTimer=null;controller?.abort();controller=null;endpoint=null;connected=false;
  $('#disconnect').hidden=true;$('#live-weight').textContent='—';$('#sample-age').textContent='No live feed. Stored readings are not substituted.';
  if(running)$('#pour-message').textContent='Connection stopped. Stop pouring until fresh readings return.';
  message(text,true);updatePlan();
}
async function poll(){
  if(!endpoint)return;
  const active=endpoint;
  const requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),2500);
  try{
    const response=await fetch(active,{signal:requestController.signal,cache:'no-store',credentials:'omit',redirect:'error',targetAddressSpace:'local'});
    if(!response.ok)throw Error('The device returned an error.');
    const sample=directSample(await response.json(),deviceCode,lastSequence);
    if(endpoint!==active)return;
    lastSequence=sample.sequence;receive(sample.weight);$('#disconnect').hidden=false;
  }catch(error){
    if(endpoint!==active)return;
    if(error.message?.includes('different VyTile')){disconnect(error.message);return;}
    $('#connection-help').textContent='No fresh live reading received. Check the device firmware, address, Wi-Fi and browser permission. The endpoint must allow Sykerbos to read it.';
    if(!fresh())message('Waiting for fresh device readings',true);
  }finally{
    clearTimeout(timeout);if(controller===requestController)controller=null;
    if(endpoint===active)pollTimer=setTimeout(poll,1000);
  }
}
$('#connect-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const url=localReadingUrl($('#device-url').value.trim());
    if(!deviceCode)throw Error('Choose a plant linked to a VyTile first.');
    if(running)throw Error('End the current session before changing the device connection.');
    disconnect();lastSequence=-1;lastSampleAt=0;endpoint=url.href;message('Connecting directly to '+deviceCode+'…');poll();
  }catch(error){$('#connection-help').textContent=error.message;}
});
$('#disconnect').addEventListener('click',()=>disconnect());
$('#start-watering').addEventListener('click',()=>{
  if(!fresh()||!(Number(amount.value)>0))return;
  baseline=lastWeight;current=lastWeight;running=true;amount.disabled=true;rate.disabled=true;$('#use-suggestion').disabled=true;
  $('#added-weight').textContent='0.0 g';$('#remaining-weight').textContent=fmt(Number(amount.value))+' g';updatePlan();
});
$('#end-watering').addEventListener('click',()=>{
  if(!running)return;
  running=false;amount.disabled=false;rate.disabled=false;
  $('#pour-message').textContent='Session ended. Allow drainage and let the final weight settle.';
  $('#use-suggestion').disabled=!(waterPlan({current:lastWeight,dry,wet,addition:0}).suggested>0);
  if(lastWeight!==null)current=lastWeight;
  updatePlan();
});
for(const input of [amount,rate])input.addEventListener('input',updatePlan);
$('#use-suggestion').addEventListener('click',()=>{const p=waterPlan({current,dry,wet,addition:0});if(p.suggested>0){amount.value=p.suggested.toFixed(1);updatePlan();}});
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>{if(demo&&running)receive(lastWeight+Number(button.dataset.add));}));
setInterval(()=>{
  if(demo||!connected)return;
  if(!fresh()){
    message('Live reading paused',true);$('#sample-age').textContent='The displayed weight is stale. Wait for fresh readings before pouring.';
    $('#start-watering').disabled=true;
    if(running)$('#pour-message').textContent='Stop pouring: fresh readings are not arriving.';
  }
},500);
window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);controller?.abort();});
function setContext({nickname,code,mass,low,high,dailyLoss,stamp,experimental=false,key=null}){
  current=numberOrNull(mass);dry=numberOrNull(low);wet=numberOrNull(high);deviceCode=code;storageKey=key;
  $('#plant-name').textContent=nickname+' · '+code;
  const plan=waterPlan({current,dry,wet,addition:0});
  $('#suggested').textContent=plan.suggested===null?'Learning':fmt(plan.suggested)+' ml';
  $('#use-suggestion').disabled=!(plan.suggested>0);
  let saved=null;try{saved=key?numberOrNull(localStorage.getItem(key)):null;}catch{}
  amount.value=saved>0?saved:plan.suggested>0?plan.suggested.toFixed(1):'';
  rate.value=Number.isFinite(dailyLoss)&&dailyLoss>0?dailyLoss.toFixed(1):'';
  $('#reference-note').textContent=dry!==null&&wet!==null?`${experimental?'Experimental':'Saved'} references: dry ${fmt(dry)} g; wet ${fmt(wet)} g. The refill suggestion returns the pot to the wet reference; it is not a species-wide dose.`:'This pot needs wet and dry references before reserve time can be estimated.';
  $('#rate-note').textContent=Number.isFinite(dailyLoss)?'Starting assumption: recent measured dry-down. You can edit it for scenario planning.':'Not enough uninterrupted dry-down to estimate a rate. Enter an assumption to explore a scenario.';
  $('#stored-reading').textContent=demo?'Planning reference: simulated 615.0 g.':`Planning reference: ${fmt(current)} g stored in Sykerbos${stamp?' · '+new Date(stamp).toLocaleString():''}. Direct live weight appears separately.`;
  updatePlan();
}
async function init(){
  if(demo){
    $('#demo-notice').hidden=false;$('#demo-controls').hidden=false;$('#direct-connection').hidden=true;$('#back-plant').href='demo.html';
    setContext({nickname:'Kitchen Basil · watering example',code:'DemoTile',mass:615,low:610,high:735,dailyLoss:18.6,experimental:true});
    receive(615);return;
  }
  const {supabase}=await import('./supabase-client.js');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.replace('account.html');return;}
  const id=params.get('plant');
  if(!id)throw Error('Open Water VyTile from a plant page so we can use that plant’s references.');
  $('#back-plant').href='plant.html?plant='+encodeURIComponent(id);
  const {data:plant,error}=await supabase.from('plants').select('*').eq('id',id).eq('user_id',session.user.id).maybeSingle();
  if(error||!plant)throw Error('This plant could not be loaded. Return to your dashboard and choose it again.');
  const {data:device}=await supabase.from('devices').select('id,device_code').eq('id',plant.device_id).maybeSingle();
  if(!device)throw Error('This plant has no VyTile assigned.');
  const {data:latest,error:readingError}=await supabase.from('readings').select('weight_g,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1);
  if(readingError)throw Error('The planning reference could not be loaded.');
  const reading=latest?.[0];
  let history=supabase.from('readings').select('weight_g,measured_at,created_at,run_id').eq('device_id',device.id).order('measured_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(72);
  if(reading?.run_id)history=history.eq('run_id',reading.run_id);
  const {data:rows}=await history;
  const valid=v=>numberOrNull(v)!==null;
  const learned=valid(plant.learned_dry_g)&&valid(plant.learned_saturated_g)&&Number(plant.learned_saturated_g)>Number(plant.learned_dry_g);
  setContext({nickname:plant.nickname||plant.common_name||'Your plant',code:device.device_code,mass:reading?.weight_g,low:learned?plant.learned_dry_g:plant.provisional_dry_g,high:learned?plant.learned_saturated_g:plant.provisional_saturated_g,dailyLoss:recentLossRate(rows),stamp:reading?.measured_at||reading?.created_at,experimental:!learned,key:'sykerbosWaterTarget:'+session.user.id+':'+id});
}
init().catch(error=>{$('#page-error').textContent=error.message;$('#page-error').hidden=false;$('#plant-name').textContent='Choose a plant to plan watering.';});
