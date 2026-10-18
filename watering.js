import {waterPlan,observedHighUse,numberOrNull,localReadingUrl,directSample} from './watering-model.js?v=4';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),demo=params.get('demo')==='1';
let current=null,dry=null,wet=null,deviceCode='',running=false,baseline=null,lastWeight=null,lastSampleAt=0,lastSequence=-1,endpoint=null,pollTimer=null,controller=null,connected=false,storageKey=null,connectionGeneration=0,addressKey=null;
let connectionStore=null,remoteSavedUrl=null,savingConnection=false,saveRetryAt=0;
let stableSamples=[],savingFullWeight=false;
let zeroing=false,tareSupported=false,tareRequestId=null,tareDeadline=0,zeroResult='';
const amount=$('#target-amount'),rate=$('#daily-rate');
const fmt=(v,d=1)=>v===null||!Number.isFinite(v)?'—':v.toFixed(d);
function message(text,bad=false){$('#connection-state').textContent=text;$('#connection-state').className='connection-state'+(bad?' stale':connected?' connected':'');}
function fresh(){return connected&&(demo||Date.now()-lastSampleAt<3000);}
function stableFullWeight(){
  if(!fresh()||stableSamples.length<8)return null;
  const points=stableSamples.slice(-8),weights=points.map(p=>p.weight);
  if(points.at(-1).time-points[0].time<3000||points.some((p,i)=>i&&p.time-points[i-1].time>1500)||Math.max(...weights)-Math.min(...weights)>2)return null;
  const sorted=[...weights].sort((a,b)=>a-b),weight=(sorted[3]+sorted[4])/2;
  const rounded=Math.round(weight);
  return rounded>0&&(dry===null||rounded>dry)?rounded:null;
}
function updateFirstWatering(){
  const gained=baseline!==null&&lastWeight!==null?Math.max(0,lastWeight-baseline):null;
  $('#added-weight').textContent=running&&gained!==null?fmt(gained)+' g':'—';
  $('#start-watering').disabled=running||zeroing||!fresh();
  $('#end-watering').disabled=!running;
  $('#start-watering').hidden=running;$('#end-watering').hidden=!running;
  $('#reconnect').hidden=demo||fresh();$('#reconnect').disabled=running;
  $('#save-full-controls').hidden=running;
  const weight=stableFullWeight(),confirmed=$('#drained-confirm').checked;
  $('#save-full-weight').disabled=running||zeroing||savingFullWeight||!confirmed||weight===null;
  $('#save-full-weight').textContent=savingFullWeight?'Saving…':weight===null?'Save full weight':`Save ${weight} g as full weight`;
  if(!savingFullWeight)$('#save-full-help').textContent=weight===null?'Waiting for a steady live weight above the dry reference.':confirmed?'Ready to save this pot’s capacity.':'Confirm the pot is watered and drained before saving.';
  $('#wet-warning').hidden=true;
  document.querySelectorAll('[data-add]').forEach(b=>b.disabled=!running);
  if(fresh())$('#pour-message').textContent=running?'First watering: stop if runoff appears. Let the pot drain.':'First watering: start to track the weight, or save an already drained pot.';
}
function updateZeroControls(){
  const empty=fresh()&&lastWeight!==null&&Math.abs(lastWeight)<=50;
  $('#open-zero').hidden=!empty||running;$('#open-zero').disabled=zeroing||savingFullWeight;
  $('#zero-tile').disabled=zeroing||running||savingFullWeight||!tareSupported||!empty||!$('#empty-tile-confirm').checked;
  $('#empty-tile-confirm').disabled=zeroing||running||savingFullWeight;
  $('#zero-tile').textContent=zeroing?'Zeroing…':'Zero empty tile';
  $('#zero-help').textContent=zeroing?'Keep the empty tile still. Saving its zero…':zeroResult||(!fresh()?'Connect your tile to zero it.':!tareSupported?'A tile firmware update is needed to enable zeroing.':!empty?'Remove the pot and saucer first.':'Confirm the tile is empty, then zero it.');
}
function updatePlan(){
  updateZeroControls();
  const first=wet===null;
  $('#first-watering').hidden=!first;
  $('#watering-target-controls').hidden=first;
  $('#remaining-metric').hidden=first;
  $('#water-progress').hidden=first;
  if(first){updateFirstWatering();return;}
  const addition=numberOrNull(amount.value),loss=numberOrNull(rate.value),start=running?baseline:current;
  const plan=waterPlan({current:start,addition,dry,wet,rate:loss});
  const suggestion=waterPlan({current:start,dry,wet,addition:0}).suggested;
  $('#suggested').textContent=suggestion===null?'Not set':fmt(suggestion)+' ml';
  $('#use-suggestion').disabled=running||!(suggestion>0);
  $('#target-weight').textContent=plan.target===null?'—':fmt(plan.target)+' g';
  $('#projected-days').textContent=plan.overWet>1e-7?'—':plan.days===null?'Learning':'~'+fmt(plan.days)+' days';
  $('#projection-note').textContent=plan.days===null?'Reserve time appears once enough reliable daily readings and wet/dry references are available.':`Estimate at ${fmt(loss)} g/day · allow a buffer for time away.`;
  const full=wet!==null&&start!==null&&start>=wet;
  $('#wet-warning').hidden=wet!==null&&!full&&plan.overWet<=1e-7;
  $('#wet-warning').textContent=wet===null?'Confirm this pot’s fully drained saturated weight before setting a watering target.':full?`At saturated weight (${fmt(wet,0)} g). No more water needed.`:`Maximum ${fmt(plan.suggested)} ml to the ${fmt(wet,0)} g saturated weight. Reduce the amount or use the suggestion.`;
  if(plan.suggested!==null)amount.max=String(Math.floor((plan.suggested+1e-7)*10)/10);
  else amount.removeAttribute('max');
  const valid=addition!==null&&addition>0&&addition<=50000&&plan.permitted;
  amount.setAttribute('aria-invalid',String(!valid&&amount.value!==''));
  $('#start-watering').disabled=running||zeroing||!fresh()||!valid;
  $('#end-watering').disabled=!running;
  $('#start-watering').hidden=running;$('#end-watering').hidden=!running;
  $('#reconnect').hidden=demo||fresh();$('#reconnect').disabled=running;
  $('#reconnect').textContent=endpoint?'Reconnect':'Connect tile';
  document.querySelectorAll('[data-add]').forEach(b=>b.disabled=!running);
  if(running&&lastWeight!==null){
    const gained=Math.max(0,lastWeight-baseline),remaining=Math.max(0,addition-gained);
    $('#added-weight').textContent=fmt(gained)+' g';$('#remaining-weight').textContent=fmt(remaining)+' g';
    $('#water-progress').value=Math.min(100,gained/addition*100);
    const atCapacity=wet!==null&&lastWeight>=wet,reached=gained>=addition||atCapacity;
    document.querySelector('.live-panel').classList.toggle('target-reached',reached);
    if(atCapacity)$('#remaining-weight').textContent='0.0 g';
    if(fresh())$('#pour-message').textContent=atCapacity?'Saturated weight reached. Stop pouring.':reached?'Target reached. Stop pouring.':remaining<=10?'Nearly there. Slow down.':'Pour slowly.';
  }
  if(storageKey&&!running&&valid){try{localStorage.setItem(storageKey,amount.value);}catch{}}
}
function receive(weight,sampleAge=0){
  lastWeight=weight;lastSampleAt=Date.now()-sampleAge;connected=true;
  if(stableSamples.length&&lastSampleAt-stableSamples.at(-1).time>1500)stableSamples=[];
  stableSamples.push({weight,time:lastSampleAt});stableSamples=stableSamples.slice(-8);
  if(!running)current=weight;
  // Round only the display; retain the full reading for targets and progress.
  $('#live-weight').textContent=fmt(Math.round(weight),0);
  message(demo?'Example':'Live · '+deviceCode);
  $('#sample-age').hidden=true;
  if(!running)$('#pour-message').textContent='Keep the pot still. Start before pouring.';
  if(!demo){
    $('#connection-help').textContent='Connected to '+deviceCode+'.';
    if(addressKey&&endpoint){try{localStorage.setItem(addressKey,endpoint);}catch{}}
    void rememberVerifiedConnection();
  }
  updatePlan();
}
function disconnect(text='Not connected to VyTile'){
  stableSamples=[];
  connectionGeneration++;
  clearTimeout(pollTimer);pollTimer=null;controller?.abort();controller=null;endpoint=null;connected=false;
  $('#disconnect').hidden=true;$('#live-weight').textContent='—';$('#sample-age').textContent='No live feed';$('#sample-age').hidden=true;
  $('#pour-message').textContent=running?'Connection stopped. Stop pouring.':'Connect your tile to start.';
  message(text,true);updatePlan();
}
async function poll(){
  if(!endpoint)return;
  const active=endpoint,generation=connectionGeneration,requestStarted=performance.now();
  const requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),2500);
  try{
    const response=await fetch(active,{signal:requestController.signal,cache:'no-store',credentials:'omit',redirect:'error',targetAddressSpace:'local'});
    if(!response.ok)throw Error(response.status===503?'The tile is waiting for a fresh sensor sample. Reconnecting automatically.':'Device returned HTTP '+response.status+'. Check the live-reading address.');
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('This address does not return live JSON. Use the firmware’s live-reading endpoint, not its home page.');
    const payload=await response.json();
    const sample=directSample(payload,deviceCode,lastSequence);
    if(endpoint!==active||generation!==connectionGeneration)return;
    const sampleAge=Number(payload.sample_age_ms)+Math.max(0,performance.now()-requestStarted);
    if(sampleAge>=3000)throw Error('The response arrived too late to use as live weight. Retrying automatically.');
    tareSupported=payload.can_tare===true;
    if(zeroing&&tareRequestId!==null&&payload.tare_id===tareRequestId&&payload.tare_status!=='pending'){
      zeroing=false;stableSamples=[];$('#empty-tile-confirm').checked=false;$('#drained-confirm').checked=false;
      zeroResult=payload.tare_status==='done'?'Zero saved on the tile. Replace your pot.':'Zero was not saved ('+String(payload.tare_status||'unknown')+'). Keep the empty tile still and retry.';
      tareRequestId=null;
    }
    lastSequence=sample.sequence;receive(sample.weight,sampleAge);$('#disconnect').hidden=false;
  }catch(error){
    if(endpoint!==active||generation!==connectionGeneration)return;
    if(error.message?.includes('different VyTile')){disconnect(error.message);return;}
    $('#connection-help').textContent=error instanceof TypeError||error.name==='AbortError'?'Cannot reach the live feed. Check Wi-Fi and local-network permission. The tile must allow this site to read its endpoint.':error instanceof SyntaxError?'The tile returned invalid JSON. Check its live-reading endpoint.':error.message;
    if(!fresh())message('Reconnecting…',true);
  }finally{
    clearTimeout(timeout);if(controller===requestController)controller=null;
    if(endpoint===active&&generation===connectionGeneration)pollTimer=setTimeout(poll,Math.max(100,500-(performance.now()-requestStarted)));
  }
}
async function rememberVerifiedConnection(){
  if(demo||!connectionStore||!endpoint||!fresh()||savingConnection||endpoint===remoteSavedUrl||Date.now()<saveRetryAt)return;
  const url=endpoint,context=connectionStore;
  savingConnection=true;
  try{
    const {data,error}=await context.client.from('plants').update({live_connection:{url,device_id:context.deviceId,verified_at:new Date(lastSampleAt).toISOString()}}).eq('id',context.plantId).eq('user_id',context.userId).eq('device_id',context.deviceId).select('id').maybeSingle();
    if(error||!data)throw error||Error('Connection preference could not be saved.');
    if(connectionStore===context)remoteSavedUrl=url;
    saveRetryAt=0;
  }catch{
    saveRetryAt=Date.now()+60000;
    if(endpoint===url)$('#connection-help').textContent='Connected. Address remembered on this browser; account save will retry.';
  }finally{savingConnection=false;}
}
function beginConnection(value){
  const url=localReadingUrl(value);
  if(!deviceCode)throw Error('Choose a plant linked to a VyTile first.');
  if(running)throw Error('End the session before changing the connection.');
  disconnect();lastSequence=-1;lastSampleAt=0;endpoint=url.href;
  $('#device-url').value=url.href;
  message('Connecting…');$('#pour-message').textContent='Connecting to your tile…';
  updatePlan();void poll();
}
$('#connect-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{beginConnection($('#device-url').value.trim());}
  catch(error){$('#connection-help').textContent=error.message;}
});
$('#reconnect').addEventListener('click',()=>{
  try{
    const value=$('#device-url').value.trim();
    if(!value){
      $('#direct-connection').open=true;
      $('#connection-help').textContent='Connect this tile once during setup. Its address will then be remembered.';
      return;
    }
    beginConnection(value);
  }catch(error){$('#connection-help').textContent=error.message;}
});
$('#disconnect').addEventListener('click',()=>disconnect());
$('#open-zero').addEventListener('click',()=>{$('#direct-connection').open=true;$('#empty-tile-confirm').focus();});
$('#empty-tile-confirm').addEventListener('change',()=>{zeroResult='';updateZeroControls();});
$('#zero-tile').addEventListener('click',async()=>{
  if(zeroing||running||savingFullWeight||!tareSupported||!fresh()||lastWeight===null||Math.abs(lastWeight)>50||!$('#empty-tile-confirm').checked)return;
  zeroing=true;zeroResult='';tareRequestId=null;tareDeadline=Date.now()+15000;stableSamples=[];updatePlan();
  if(demo){zeroing=false;$('#empty-tile-confirm').checked=false;zeroResult='Example zero saved. Replace your pot.';receive(0);return;}
  const request=new AbortController(),timeout=setTimeout(()=>request.abort(),6000);
  try{
    const response=await fetch(new URL('/tare',endpoint).href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_code:deviceCode,confirm_empty:true}),cache:'no-store',credentials:'omit',redirect:'error',targetAddressSpace:'local',signal:request.signal});
    const payload=await response.json();
    if(response.status!==202||payload.device_code!==deviceCode||!Number.isSafeInteger(payload.tare_id)||payload.tare_id<1||payload.tare_status!=='pending')throw Error('Zero request was not accepted.');
    tareRequestId=payload.tare_id;
  }catch(error){zeroing=false;zeroResult='Could not confirm zeroing. Check the empty live reading before retrying.';updatePlan();}
  finally{clearTimeout(timeout);}
});

$('#start-watering').addEventListener('click',()=>{
  const plan=waterPlan({current:lastWeight,addition:amount.value,dry,wet});
  if(zeroing||!fresh()||(wet!==null&&(!plan.permitted||Number(amount.value)>50000))){updatePlan();return;}
  baseline=lastWeight;current=lastWeight;running=true;amount.disabled=true;rate.disabled=true;$('#use-suggestion').disabled=true;
  $('#added-weight').textContent='0.0 g';$('#remaining-weight').textContent=fmt(Number(amount.value))+' g';updatePlan();
});
$('#end-watering').addEventListener('click',()=>{
  if(!running)return;
  running=false;amount.disabled=false;rate.disabled=false;
  $('#pour-message').textContent='Session ended. Let it drain.';
  if(wet===null){stableSamples=[];$('#drained-confirm').checked=false;}
  $('#use-suggestion').disabled=!(waterPlan({current:lastWeight,dry,wet,addition:0}).suggested>0);
  if(lastWeight!==null)current=lastWeight;
  $('#added-weight').textContent='—';$('#remaining-weight').textContent='—';$('#water-progress').value=0;
  document.querySelector('.live-panel').classList.toggle('target-reached',false);
  updatePlan();
});
$('#drained-confirm').addEventListener('change',updatePlan);
$('#save-full-weight').addEventListener('click',async()=>{
  const weight=stableFullWeight();
  if(wet!==null||running||zeroing||savingFullWeight||!$('#drained-confirm').checked||weight===null)return;
  savingFullWeight=true;updatePlan();
  try{
    if(!demo){
      if(!connectionStore)throw Error('Plant connection is unavailable.');
      const context=connectionStore;
      const {data,error}=await context.client.from('plants').update({learned_saturated_g:weight,provisional_saturated_g:weight}).eq('id',context.plantId).eq('user_id',context.userId).eq('device_id',context.deviceId).select('id').maybeSingle();
      if(error||!data)throw error||Error('No plant was updated.');
    }
    wet=weight;current=lastWeight;amount.value='0';
    $('#reference-note').textContent=`Saturated weight ${weight} g · saved after your drained-pot confirmation.`;
    $('#pour-message').textContent='Full weight saved. No more water needed.';
    savingFullWeight=false;updatePlan();
  }catch(error){savingFullWeight=false;updatePlan();$('#save-full-help').textContent='Could not save. Your weight is still live; try again.';}
});
for(const input of [amount,rate])input.addEventListener('input',updatePlan);
$('#use-suggestion').addEventListener('click',()=>{const p=waterPlan({current,dry,wet,addition:0});if(p.suggested>0){amount.value=String(Math.floor((p.suggested+1e-7)*10)/10);updatePlan();}});
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>{if(demo&&running)receive(lastWeight+Number(button.dataset.add));}));
setInterval(()=>{
  if(zeroing&&Date.now()>tareDeadline){zeroing=false;tareRequestId=null;zeroResult='Could not confirm zeroing. Check the empty live reading before retrying.';updatePlan();}
  if(demo){if(wet===null&&connected)receive(lastWeight);return;}
  if(!connected)return;
  if(!fresh()){
    message('Reconnecting…',true);$('#sample-age').hidden=false;$('#sample-age').textContent='Last reading · reconnecting…';
    $('#save-full-weight').disabled=true;$('#zero-tile').disabled=true;stableSamples=[];
    $('#start-watering').disabled=true;$('#reconnect').hidden=false;$('#reconnect').disabled=running;
    $('#pour-message').textContent=running?'Stop pouring: fresh readings are not arriving.':'Waiting for your tile. Stay on the same Wi-Fi.';
  }
},500);
window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);controller?.abort();});
function setContext({nickname,code,mass,low,high,dailyLoss,stamp,experimental=false,key=null,savedConnection=null,usage=null}){
  stableSamples=[];
  current=numberOrNull(mass);dry=numberOrNull(low);wet=numberOrNull(high);deviceCode=code;storageKey=key;addressKey=key?key+':liveAddress:'+code:null;
  if(addressKey){try{const saved=localStorage.getItem(addressKey)||localStorage.getItem(key+':liveAddress');if(saved)$('#device-url').value=localReadingUrl(saved).href;}catch{}}
  if(savedConnection){try{$('#device-url').value=localReadingUrl(savedConnection).href;remoteSavedUrl=$('#device-url').value;}catch{}}
  $('#plant-name').textContent=nickname+' · '+code;
  const plan=waterPlan({current,dry,wet,addition:0});
  $('#suggested').textContent=plan.suggested===null?'Not set':fmt(plan.suggested)+' ml';
  $('#use-suggestion').disabled=!(plan.suggested>0);
  let saved=null;try{saved=key?numberOrNull(localStorage.getItem(key)):null;}catch{}
  amount.value=plan.suggested>0?String(Math.floor((Math.min(saved>0?saved:plan.suggested,plan.suggested)+1e-7)*10)/10):'';
  rate.value=Number.isFinite(dailyLoss)&&dailyLoss>0?dailyLoss.toFixed(1):'';
  $('#reference-note').textContent=dry!==null&&wet!==null?`Saturated weight ${fmt(wet,0)} g · ${experimental?'experimental':'saved'} dry reference ${fmt(dry,0)} g.`:'This pot needs wet and dry references before reserve time can be estimated.';
  rate.readOnly=true;
  const usageText=demo?'Example use · 18.6 g/day':usage?.rate?`${usage.qualifyingDays<7?'Early estimate · ':'Measured high use · '}${fmt(usage.rate)} g/day · ${usage.usedDays} of ${usage.qualifyingDays} days`:'Learning daily use';
  $('#reserve-use').textContent=usageText;
  $('#rate-note').textContent=demo?'Illustrative data for this example.':usage?.rate?`Average of the higher-use half of ${usage.qualifyingDays} reliable, completed days in this measurement run (last 30 days). Watering, abrupt shifts and gaps are excluded. ${usage.qualifyingDays<7?'Early estimate; more cycles will improve it. ':''}Weight loss includes evaporation.`:`${usage?.qualifyingDays||0} reliable days so far. At least 3 are needed. No fixed species assumption is used.`;
  $('#stored-reading').textContent=demo?'Planning reference: simulated 615.0 g.':`Stored planning weight: ${fmt(current)} g${stamp?' · '+new Date(stamp).toLocaleString():''}.`;
  updatePlan();
}
async function init(){
  if(demo){
    $('#demo-notice').hidden=false;$('#demo-controls').hidden=false;$('#direct-connection').hidden=true;$('#back-plant').href='demo.html';
    setContext({nickname:'Kitchen Basil · watering example',code:'DemoTile',mass:615,low:610,high:params.get('first')==='1'?null:735,dailyLoss:18.6,experimental:true});
    tareSupported=true;receive(params.get('zero')==='1'?-5:615);return;
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
  connectionStore={client:supabase,plantId:id,userId:session.user.id,deviceId:device.id};
  const savedConnection=plant.live_connection?.device_id===device.id?plant.live_connection.url:null;
  const valid=v=>numberOrNull(v)!==null;
  const learnedDry=valid(plant.learned_dry_g),confirmedWet=valid(plant.learned_saturated_g)&&Number(plant.learned_saturated_g)>0;
  setContext({nickname:plant.nickname||plant.common_name||'Your plant',code:device.device_code,mass:reading?.weight_g,low:learnedDry?plant.learned_dry_g:plant.provisional_dry_g,high:confirmedWet?plant.learned_saturated_g:null,dailyLoss:null,usage:null,stamp:reading?.measured_at||reading?.created_at,experimental:!learnedDry,key:'sykerbosWaterTarget:'+session.user.id+':'+id,savedConnection});
  if($('#device-url').value){
    try{beginConnection($('#device-url').value.trim());}catch(error){$('#connection-help').textContent=error.message;}
  }else{message('Setup needed');$('#pour-message').textContent='Connect your tile once to enable live watering.';}
  try{
    const rows=[],cutoff=new Date(Date.now()-30*86400000).toISOString();
    for(let offset=0;offset<5000;offset+=1000){
      let query=supabase.from('readings').select('id,weight_g,measured_at,created_at,run_id').eq('device_id',device.id);
      query=reading?.run_id==null?query.is('run_id',null):query.eq('run_id',reading.run_id);
      const {data,error}=await query.gte('created_at',cutoff).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<1000)break;
    }
    const usage=observedHighUse(rows,{dry});
    rate.value=usage.rate?usage.rate.toFixed(1):'';
    $('#reserve-use').textContent=usage.rate?`${usage.qualifyingDays<7?'Early estimate · ':'Measured high use · '}${fmt(usage.rate)} g/day · ${usage.usedDays} of ${usage.qualifyingDays} days`:'Learning daily use';
    $('#rate-note').textContent=usage.rate?`Average of the higher-use half of ${usage.qualifyingDays} reliable, completed days in this measurement run (last 30 days). Watering, abrupt shifts and gaps are excluded. ${usage.qualifyingDays<7?'Early estimate; more cycles will improve it. ':''}Weight loss includes evaporation.`:`${usage.qualifyingDays} reliable days so far. At least 3 are needed. No fixed species assumption is used.`;
    updatePlan();
  }catch(error){$('#rate-note').textContent='Daily-use history could not be loaded. Reopen this page to retry.';}

}
init().catch(error=>{$('#page-error').textContent=error.message;$('#page-error').hidden=false;$('#plant-name').textContent='Choose a plant to plan watering.';});
