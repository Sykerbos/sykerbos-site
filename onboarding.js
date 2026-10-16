const slides=[...document.querySelectorAll('.setup-slide')];
const next=document.querySelector('#next'),back=document.querySelector('#back'),label=document.querySelector('#step-label'),bar=document.querySelector('#progress-bar'),dots=document.querySelector('#dots'),container=document.querySelector('#slides');
const plantNameInput=document.querySelector('#plant-name'),plantNameDisplay=document.querySelector('#plant-name-display');
let index=Number(localStorage.getItem('sykerbosOnboardingStep')||0);
// Migrate the previous ten-step preview without skipping first-cycle preparation.
if(localStorage.getItem('sykerbosOnboardingFlowVersion')!=='wet-reference-v1'){
  if(index===7||index===8) index=7;
  else if(index===9) index=12;
  localStorage.setItem('sykerbosOnboardingFlowVersion','wet-reference-v1');
}
index=Number.isFinite(index)?Math.max(0,Math.min(index,slides.length-1)):0;
slides.forEach((_,i)=>{const d=document.createElement('span');d.dataset.i=i;dots.appendChild(d)});
const dotEls=[...dots.children];

function syncPlantName(){
  const name=(plantNameInput?.value||'Kitchen Rosemary').trim()||'Kitchen Rosemary';
  localStorage.setItem('sykerbosPlantName',name);
  if(plantNameDisplay) plantNameDisplay.textContent=name;
}
if(plantNameInput){
  const saved=localStorage.getItem('sykerbosPlantName');
  if(saved) plantNameInput.value=saved;
  plantNameInput.addEventListener('input',syncPlantName);
}
syncPlantName();

function render(push=true){
  slides.forEach((s,i)=>s.classList.toggle('active',i===index));
  dotEls.forEach((d,i)=>d.classList.toggle('active',i===index));
  label.textContent=`Step ${index+1} of ${slides.length}`;
  bar.style.width=`${((index+1)/slides.length)*100}%`;
  back.style.visibility=index===0?'hidden':'visible';
  next.textContent=index===0?'Get started →':index===slides.length-1?'Finish setup →':'Continue →';
  localStorage.setItem('sykerbosOnboardingStep',String(index));
  if(push) history.pushState({setupStep:index},'',`#step-${index+1}`);
}

function go(delta){
  const target=Math.max(0,Math.min(slides.length-1,index+delta));
  if(target!==index){index=target;syncPlantName();render()}
}

next.addEventListener('click',()=>{
  if(index===slides.length-1){
    syncPlantName();
    localStorage.setItem('sykerbosOnboardingComplete','true');
    next.textContent='Opening Sykerbos…';
    localStorage.setItem('sykerbosOnboardingStep','0');
    window.location.href='app.html';
    return;
  }
  go(1);
});
back.addEventListener('click',()=>go(-1));
window.addEventListener('popstate',()=>{if(index>0){index--;render(false)}});
let startX=null,startY=null;
container.addEventListener('touchstart',e=>{startX=e.changedTouches[0].clientX;startY=e.changedTouches[0].clientY},{passive:true});
container.addEventListener('touchend',e=>{
  if(startX===null)return;
  const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
  if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.4)go(dx<0?1:-1);
  startX=startY=null;
},{passive:true});
render(false);