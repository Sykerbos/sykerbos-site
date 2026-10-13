const savedName=localStorage.getItem('sykerbosPlantName')||'Kitchen Rosemary';
document.querySelector('#plant-title').textContent=savedName;
document.title=`${savedName} — Sykerbos`;

const tabs=[...document.querySelectorAll('.plant-tabs button')];
const panels=[...document.querySelectorAll('.plant-tab-panel')];
tabs.forEach(button=>button.addEventListener('click',()=>{
  const target=button.dataset.tab;
  tabs.forEach(b=>b.classList.toggle('active',b===button));
  panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===target));
  history.replaceState(null,'',`#${target}`);
}));
const hash=location.hash.replace('#','');
if(hash){
  const button=tabs.find(b=>b.dataset.tab===hash);
  if(button) button.click();
}
document.querySelectorAll('.range-pills button').forEach(button=>button.addEventListener('click',()=>{
  button.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
  button.classList.add('active');
}));