import { supabase } from './supabase-client.js';

const tabs=[...document.querySelectorAll('.account-tabs button')];
const form=document.querySelector('#account-form');
const email=document.querySelector('#email');
const password=document.querySelector('#password');
const submit=document.querySelector('#submit-account');
const message=document.querySelector('#account-message');

let mode='signin';

function setMessage(text,type=''){
  message.textContent=text;
  message.className='account-message'+(type?' '+type:'');
}

tabs.forEach(tab=>tab.addEventListener('click',()=>{
  mode=tab.dataset.mode;
  tabs.forEach(t=>t.classList.toggle('active',t===tab));
  submit.textContent=mode==='signin'?'Sign in':'Create account';
  password.autocomplete=mode==='signin'?'current-password':'new-password';
  setMessage('');
}));

form.addEventListener('submit',async event=>{
  event.preventDefault();
  submit.disabled=true;
  setMessage(mode==='signin'?'Signing in…':'Creating your account…');
  const credentials={email:email.value.trim(),password:password.value};

  const {data,error}=mode==='signin'
    ? await supabase.auth.signInWithPassword(credentials)
    : await supabase.auth.signUp(credentials);

  submit.disabled=false;
  if(error){setMessage(error.message,'error');return;}

  if(mode==='signup' && !data.session){
    setMessage('Account created. Check your email to confirm it, then return here to sign in.','success');
    return;
  }
  location.href='app.html';
});

const {data:{session}}=await supabase.auth.getSession();
if(session) location.href='app.html';
