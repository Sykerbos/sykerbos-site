// Keep older shared demo links useful while the collection owns the demo flow.
const params=new URLSearchParams(location.search);
const plant=params.get('plant');
const sample=plant==='orange'?'demo-b':plant==='basil'?'demo-a':null;
location.replace(sample?'plant.html?demo=watering&collection='+sample:'app.html?demo=collection'+(location.hash==='#settings'?'#settings':''));
