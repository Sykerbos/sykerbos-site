import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountRequest} from '../account-flow.js';
const calls=[];
const request=(mode,result)=>accountRequest({mode,email:' person@example.com ',password:'example password',loadClient:async()=>({auth:{
  signUp:async input=>{calls.push(['signup',input]);return result;},
  signInWithPassword:async input=>{calls.push(['signin',input]);return result;}
}})});
assert.equal((await request('signin',{data:{session:{user:{id:'one'}}}})).next,'app.html');
assert.equal(calls[0][1].email,'person@example.com');
assert.equal((await request('signup',{data:{session:null}})).type,'success');
assert.match((await request('signup',{error:{code:'over_email_send_rate_limit',status:429}})).message,/guest demo/);
assert.match((await request('signin',{error:{code:'invalid_credentials'}})).message,/not recognised/);
assert.equal((await request('signin',{data:{session:null}})).next,undefined);
const failed=await accountRequest({mode:'signin',email:'a@b.com',password:'x',loadClient:async()=>{throw Error('CDN offline');}});
assert.match(failed.message,/guest demo/);
assert.equal(failed.type,'error');
// The entire guest import graph must stay local and independent of auth/CDNs.
for(const entry of ['app.js','plant.js']){
  const seen=new Set();
  function walk(path){
    if(seen.has(path))return;seen.add(path);
    const code=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
    for(const m of code.matchAll(/^import\s+[^;]*?from\s+['"]([^'"]+)['"]/gm)){
      const dep=m[1].split('?')[0];assert.ok(dep.startsWith('./'),entry+' external dependency '+dep);
      assert.notEqual(dep,'./supabase-client.js',entry+' must not load auth before choosing guest');
      walk(dep.slice(2));
    }
  }
  walk(entry);
}
const html=fs.readFileSync(new URL('../account.html',import.meta.url),'utf8');
assert.ok(html.indexOf('id="guest-button"')<html.indexOf('id="account-form"'));
assert.match(html,/id="guest-button"[^>]*href="app.html\?demo=collection"/);
console.log('Passed: sign-in/signup outcomes, email rate-limit and network recovery, prominent guest entry and auth-free guest module graph.');
