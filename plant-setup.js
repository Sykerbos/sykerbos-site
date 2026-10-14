import { supabase } from './supabase-client.js';

const forms=document.querySelector('#device-forms');
const saveButton=document.querySelector('#save-plants');
const message=document.querySelector('#setup-message');

function setMessage(text,type=''){
  message.textContent=text;
  message.className='setup-message'+(type?' '+type:'');
}

function fmtNumber(value,suffix,digits=1){
  const n=Number(value);
  return Number.isFinite(n)?n.toFixed(digits)+' '+suffix:'—';
}

const {data:{session}}=await supabase.auth.getSession();
if(!session){
  location.replace('account.html');
} else {
  const user=session.user;
  const {data:links,error:linkError}=await supabase
    .from('user_devices')
    .select('device_id')
    .eq('user_id',user.id);

  if(linkError){
    forms.innerHTML='<article class="setup-card"><p>Could not load your VyTiles.</p></article>';
    saveButton.disabled=true;
  } else if(!links?.length){
    forms.innerHTML='<article class="setup-card"><p>You do not have any claimed VyTiles yet.</p></article>';
    saveButton.disabled=true;
  } else {
    const ids=links.map(x=>x.device_id);
    const [{data:devices,error:deviceError},{data:plants,error:plantError}]=await Promise.all([
      supabase.from('devices').select('id,device_code,model').in('id',ids).order('device_code'),
      supabase.from('plants').select('*').eq('user_id',user.id)
    ]);

    if(deviceError||plantError){
      forms.innerHTML='<article class="setup-card"><p>Could not load plant setup.</p></article>';
      saveButton.disabled=true;
    } else {
      const byDevice=new Map((plants||[]).map(p=>[p.device_id,p]));
      const cards=[];

      for(const device of devices||[]){
        const plant=byDevice.get(device.id);
        const {data:reading}=await supabase
          .from('readings')
          .select('weight_g,temperature_c,measured_at,created_at')
          .eq('device_id',device.id)
          .order('measured_at',{ascending:false,nullsFirst:false})
          .order('created_at',{ascending:false})
          .limit(1)
          .maybeSingle();

        const nickname=plant?.nickname||'';
        const common=plant?.common_name||'';
        const botanical=plant?.botanical_name||'';
        const isPrimary=Boolean(plant?.is_primary);
        const stamp=reading?.measured_at||reading?.created_at;

        cards.push(`<article class="setup-card" data-device-id="${device.id}" data-plant-id="${plant?.id||''}">
          <div class="setup-card-header">
            <div>
              <p class="eyebrow">${device.device_code}</p>
              <h2>${device.model}</h2>
              <p class="device-meta">Claimed VyTile</p>
            </div>
            <label class="primary-choice"><input type="radio" name="primary-plant" ${isPrimary?'checked':''}> Show as main plant</label>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Plant name</label>
              <input class="nickname" type="text" value="${nickname.replaceAll('"','&quot;')}" placeholder="e.g. Kitchen Rosemary">
              <span class="field-note">The name you use at home.</span>
            </div>
            <div class="field">
              <label>Common name</label>
              <input class="common-name" type="text" value="${common.replaceAll('"','&quot;')}" placeholder="e.g. Rosemary">
              <span class="field-note">Optional for now.</span>
            </div>
            <div class="field">
              <label>Botanical name</label>
              <input class="botanical-name" type="text" value="${botanical.replaceAll('"','&quot;')}" placeholder="e.g. Salvia rosmarinus">
              <span class="field-note">Optional for now.</span>
            </div>
          </div>
          <div class="live-row">
            <div class="live-pill"><small>Latest weight</small><strong>${fmtNumber(reading?.weight_g,'g')}</strong></div>
            <div class="live-pill"><small>Temperature</small><strong>${fmtNumber(reading?.temperature_c,'°C')}</strong></div>
            <div class="live-pill"><small>Last reading</small><strong>${stamp?new Date(stamp).toLocaleString():'—'}</strong></div>
          </div>
        </article>`);
      }

      forms.innerHTML=cards.join('');

      const primaryInputs=[...document.querySelectorAll('input[name="primary-plant"]')];
      if(primaryInputs.length && !primaryInputs.some(i=>i.checked)) primaryInputs[0].checked=true;

      saveButton.addEventListener('click',async()=>{
        const cards=[...document.querySelectorAll('.setup-card[data-device-id]')];
        const rows=cards.map((card,index)=>{
          const nickname=card.querySelector('.nickname').value.trim();
          const common=card.querySelector('.common-name').value.trim();
          const botanical=card.querySelector('.botanical-name').value.trim();
          return {
            id:card.dataset.plantId||undefined,
            user_id:user.id,
            device_id:card.dataset.deviceId,
            nickname:nickname||common||'Unnamed plant',
            common_name:common||null,
            botanical_name:botanical||null,
            status:'learning',
            is_primary:card.querySelector('input[name="primary-plant"]').checked,
            display_order:index
          };
        });

        saveButton.disabled=true;
        setMessage('Saving your plants…');

        // Clear the previous primary first so the unique-primary rule never conflicts.
        const {error:clearError}=await supabase
          .from('plants')
          .update({is_primary:false})
          .eq('user_id',user.id);

        if(clearError){
          saveButton.disabled=false;
          setMessage(clearError.message,'error');
          return;
        }

        for(const row of rows){
          let result;
          if(row.id){
            const id=row.id;
            delete row.id;
            result=await supabase.from('plants').update(row).eq('id',id).eq('user_id',user.id);
          }else{
            delete row.id;
            result=await supabase.from('plants').insert(row);
          }
          if(result.error){
            saveButton.disabled=false;
            setMessage(result.error.message,'error');
            return;
          }
        }

        setMessage('Plants saved. Building your dashboard…','success');
        setTimeout(()=>location.href='app.html',700);
      });
    }
  }
}
