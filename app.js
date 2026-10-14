
const claimButton=document.querySelector('#claim-alpha-button');
const claimCode=document.querySelector('#claim-code');
const claimMessage=document.querySelector('#claim-message');

function setClaimMessage(text,type=''){
  if(!claimMessage) return;
  claimMessage.textContent=text;
  claimMessage.className='claim-message'+(type?' '+type:'');
}

if(claimButton){
  claimButton.addEventListener('click',async()=>{
    const code=(claimCode?.value||'').trim();
    if(!code){
      setClaimMessage('Enter the claim code first.','error');
      return;
    }

    claimButton.disabled=true;
    setClaimMessage('Contacting Sykerbos…');

    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){
        setClaimMessage('Your sign-in session has expired. Please sign in again.','error');
        return;
      }

      const response=await fetch('https://nyivtwiliacawkfcyget.supabase.co/functions/v1/claim-alpha-devices',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':'sb_publishable_9aNvqxT3JXKqFLCyj-Ckeg_85lOHX2B',
          'Authorization':'Bearer '+session.access_token
        },
        body:JSON.stringify({code})
      });

      let payload={};
      try{ payload=await response.json(); }catch{}

      if(!response.ok || payload?.error){
        setClaimMessage(payload?.error||('Claim request failed ('+response.status+').'),'error');
        return;
      }

      setClaimMessage('Claimed: '+(payload.devices||[]).join(', '),'success');
      setTimeout(()=>location.reload(),900);
    }catch(error){
      setClaimMessage('Could not reach the claim service. Please try again.','error');
    }finally{
      claimButton.disabled=false;
    }
  });
}

import { supabase } from './supabase-client.js';

const savedName=localStorage.getItem('sykerbosPlantName')||'Kitchen Rosemary';
document.querySelectorAll('#primary-plant-name,#plant-card-name').forEach(el=>el.textContent=savedName);

const {data:{session}}=await supabase.auth.getSession();
if(!session){
  location.replace('account.html');
} else {
  const user=session.user;
  const isGuest=Boolean(user.is_anonymous);
  const profileButton=document.querySelector('#profile-button');
  profileButton.textContent=isGuest?'G':(user.email||'S').slice(0,2).toUpperCase();
  profileButton.title=isGuest?'Guest session':(user.email||'Sykerbos account');

  const {data:links,error:linkError}=await supabase
    .from('user_devices')
    .select('device_id')
    .eq('user_id',user.id);

  if(linkError){
    setDeviceEmpty('Could not load devices','Please refresh and try again.');
  } else if(!links?.length){
    setDeviceEmpty(isGuest?'Guest mode':'No VyTile claimed yet',
      isGuest?'Explore Sykerbos freely. Create an account when you are ready to connect a VyTile.':'Your account is ready. We can now attach Mini01 and Mini02 to it.');
  } else {
    const ids=links.map(x=>x.device_id);
    const {data:devices}=await supabase.from('devices').select('*').in('id',ids).order('device_code');
    const device=devices?.find(d=>d.device_code==='Mini01')||devices?.[0];
    if(device){
      const {data:reading,error:readingError}=await supabase
        .from('readings')
        .select('weight_g,temperature_c,measured_at,created_at')
        .eq('device_id',device.id)
        .order('measured_at',{ascending:false,nullsFirst:false})
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();

      document.querySelector('#device-heading').textContent=`${device.device_code} · ${reading?'Connected':'No recent reading'}`;
      document.querySelector('#device-meta').textContent=`${device.model} · Alpha device`;

      if(reading && !readingError){
        const weight=Number(reading.weight_g);
        const temp=Number(reading.temperature_c);
        const weightText=Number.isFinite(weight)?`${weight.toFixed(1)} g`:'—';
        const tempText=Number.isFinite(temp)?`${temp.toFixed(1)} °C`:'—';
        document.querySelector('#live-weight').textContent=weightText;
        document.querySelector('#live-temp').textContent=tempText;
        document.querySelector('#card-weight').textContent=weightText;
        document.querySelector('#card-temp').textContent=tempText;
        document.querySelector('#temp-status').textContent='Live VyTile reading';
        const stamp=reading.measured_at||reading.created_at;
        document.querySelector('#live-reading-label').textContent=stamp?`Latest · ${new Date(stamp).toLocaleString()}`:'Latest reading';
      }
    }
  }
}

function setDeviceEmpty(title,copy){
  document.querySelector('#device-heading').textContent=title;
  document.querySelector('#device-meta').textContent=copy;
}

document.querySelector('#profile-button')?.addEventListener('click',async()=>{
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
document.querySelector('.add-card')?.addEventListener('click',()=>location.href='start.html?new=1');


