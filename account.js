import {accountRequest} from './account-flow.js?v=1';
const tabs=[...document.querySelectorAll('.account-tabs button')];
const form=document.querySelector('#account-form');
const email=document.querySelector('#email');
const password=document.querySelector('#password');
const submit=document.querySelector('#submit-account');
const message=document.querySelector('#account-message');
let mode='signin',busy=false;
function setMessage(text,type=''){message.textContent=text;message.className='account-message'+(type?' '+type:'');}
async function loadClient(){
  let timeout;
  try{
    const result=await Promise.race([import('./supabase-client.js'),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Sign-in timed out')),12000);})]);
    return result.supabase;
  }finally{clearTimeout(timeout);}
}
tabs.forEach(tab=>tab.addEventListener('click',()=>{
  if(busy)return;
  mode=tab.dataset.mode;
  tabs.forEach(t=>{t.classList.toggle('active',t===tab);t.setAttribute('aria-selected',String(t===tab));});
  submit.textContent=mode==='signin'?'Sign in':'Create account';
  password.autocomplete=mode==='signin'?'current-password':'new-password';
  setMessage('');
}));
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  busy=true;submit.disabled=true;tabs.forEach(t=>t.disabled=true);
  setMessage(mode==='signin'?'Signing in…':'Creating your account…');
  try{
    const result=await accountRequest({mode,email:email.value,password:password.value,loadClient});
    if(result.next){location.href=result.next;return;}
    setMessage(result.message,result.type);
  }finally{
    busy=false;submit.disabled=false;tabs.forEach(t=>t.disabled=false);
  }
});
// Only handle an explicit email-confirmation return automatically. An existing
// account session must never prevent the visitor from choosing the public demo.
const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
if(query.has('error')||hash.has('error')){
  setMessage('That email link could not be completed. Please request a fresh link or try the guest demo.','error');
}else if(query.has('code')||hash.has('access_token')){
  setMessage('Confirming your account…');
  loadClient().then(async client=>{
    const {data,error}=await client.auth.getSession();
    if(error||!data?.session){setMessage('Confirmation did not finish. Try signing in below.','error');return;}
    location.replace('app.html');
  }).catch(()=>setMessage('Could not finish confirmation. Please try signing in below.','error'));
}
