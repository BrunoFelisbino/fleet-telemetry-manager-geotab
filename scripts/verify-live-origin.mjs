// Public-read smoke checks run from GitHub Actions, outside the Geotab session.
import assert from 'node:assert/strict';
const host='https://ftmbrunog2026.vercel.app';
const paths=['/index.html','/mileage/index.html','/incidents/index.html','/health/index.html','/exceptions/index.html','/trips/index.html','/icon.svg'];
for(const path of paths){
  const res=await fetch(host+path,{headers:{Origin:'https://my.geotab.com',Accept:'*/*'},signal:AbortSignal.timeout(15000)});
  assert.equal(res.status,200,path+' must return 200 to MyGeotab, got '+res.status);
  assert.equal(res.headers.get('access-control-allow-origin'),'*',path+' missing cross-origin allow header');
  const type=res.headers.get('content-type')||'';
  assert.ok(type.includes(path.endsWith('.svg')?'image/svg+xml':'text/html'),path+' unexpected content-type '+type);
  const body=await res.text();
  assert.ok(body.length>100,path+' empty response');
  assert.ok(!/Vercel Authentication|Authentication Required|Sign in to Vercel/i.test(body),path+' behind protection');
  console.log('OK '+path+': 200, '+type+', CORS '+res.headers.get('access-control-allow-origin'));
}
