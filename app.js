const savedName=localStorage.getItem('sykerbosPlantName')||'Kitchen Rosemary';
document.querySelectorAll('#primary-plant-name,#plant-card-name').forEach(el=>el.textContent=savedName);
document.querySelectorAll('.recommendation-grid button').forEach(button=>{
  button.addEventListener('click',()=>{
    const saved=button.dataset.saved==='true';
    button.dataset.saved=String(!saved);
    button.textContent=saved?'♡ Want to grow':'♥ Saved';
  });
});
document.querySelector('.add-card')?.addEventListener('click',()=>location.href='start.html?new=1');
