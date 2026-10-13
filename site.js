const header=document.querySelector('.site-header');
const menu=document.querySelector('.menu-button');
if(menu&&header){
  menu.addEventListener('click',()=>{
    const open=header.classList.toggle('open');
    menu.setAttribute('aria-expanded',String(open));
  });
  document.querySelectorAll('.site-nav a').forEach(link=>link.addEventListener('click',()=>{
    header.classList.remove('open');
    menu.setAttribute('aria-expanded','false');
  }));
}