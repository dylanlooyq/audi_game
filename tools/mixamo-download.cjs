// Downloads Mixamo animations into src/assets/animations/ using YOUR Mixamo session.
//
//   Windows PowerShell:  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
//                        .\node_modules\electron\dist\electron.exe tools\mixamo-download.cjs
//
// It opens a window on mixamo.com. Log in there once (the login is remembered in tools/.mixamo-session/), and the
// script reads the session token from that page itself - nothing is typed into or stored by this tool. Then it
// searches for each animation below, exports it as FBX (Without Skin, 30 fps, In Place) through Mixamo's own web API
// and saves it. This is an unofficial API, so it may need adjusting if Mixamo changes it.
const { app, BrowserWindow, net, session } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'src', 'assets', 'animations');
const LOG = process.env.MIXAMO_LOG || path.join(__dirname, '.mixamo-download.log');
const WANT = (process.env.MIXAMO_ANIMS ? JSON.parse(process.env.MIXAMO_ANIMS) : [
  // waiting + miss reactions
  'Breathing Idle', 'Crying', 'Defeated',
  // dances
  'Hip Hop Dancing', 'Silly Dancing', 'Northern Soul Spin', 'Robot Hip Hop Dance', 'Rumba Dancing',
  'Swing Dancing', 'Snake Hip Hop Dance', 'Wave Hip Hop Dance', 'Chicken Dance', 'Jazz Dancing',
  'House Dancing', 'Macarena Dance', 'Thriller Part 2', 'Gangnam Style', 'Bboy Hip Hop Move', 'Breakdance Freezes',
]);

const log = (s) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${s}`; console.log(line); fs.appendFileSync(LOG, line + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeName = (s) => s.replace(/[^\w\- ().]/g, '').trim();

app.setPath('userData', path.join(__dirname, '.mixamo-session'));
process.on('unhandledRejection', (e) => { log('ERROR ' + (e && e.stack || e)); app.quit(); });

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 1200, height: 800, title: 'Mixamo - log in, then leave this window open', webPreferences: { contextIsolation: true } });
  win.loadURL('https://www.mixamo.com/#/?page=1&type=Motion%2CMotionPack');
  const page = (code) => win.webContents.executeJavaScript(code);

  // 1. wait for the user to log in
  log('WAITING_FOR_LOGIN: log in to Mixamo in the window that just opened');
  let token = null;
  for (let i = 0; i < 900 && !token; i++) { // up to 30 minutes
    try { token = await page(`localStorage.getItem('access_token')`); } catch {}
    if (!token) await sleep(2000);
  }
  if (!token) { log('ERROR: never saw a login'); return app.quit(); }
  log('LOGGED_IN');

  // Calls Mixamo's API from inside the page (same origin, so cookies/CORS just work). Token stays inside the page.
  const api = (method, url, body) => page(`(async () => {
    const r = await fetch('https://www.mixamo.com/api/v1${url}', { method: ${JSON.stringify(method)},
      headers: { Authorization: 'Bearer ' + localStorage.getItem('access_token'), 'X-Api-Key': 'mixamo2', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: ${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'} });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text: json ? undefined : text.slice(0, 300) };
  })()`);

  const prim = await api('GET', '/characters/primary');
  log('primary character response: ' + JSON.stringify(prim).slice(0, 300));
  const cid = prim.json && (prim.json.primary_character_id || prim.json.id || prim.json.character_id);
  if (!cid) { log('ERROR: could not get a character id'); return app.quit(); }

  const results = [];
  for (const want of WANT) {
    const file = path.join(OUT, safeName(want) + '.fbx');
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) { log(`skip "${want}" (already downloaded)`); results.push([want, 'have']); continue; }
    try {
      const q = await api('GET', `/products?page=1&limit=48&order=&type=Motion%2CMotionPack&query=${encodeURIComponent(want)}`);
      const found = (q.json && q.json.results || []).filter((r) => r.type === 'Motion');
      const hit = found.find((r) => r.name.toLowerCase() === want.toLowerCase()) || found[0];
      if (!hit) { log(`"${want}": no search results (status ${q.status})`); results.push([want, 'not found']); continue; }
      log(`"${want}" -> "${hit.name}" (${hit.id})`);

      const prod = await api('GET', `/products/${hit.id}?similar=0&character_id=${cid}`);
      const gms = prod.json && prod.json.details && prod.json.details.gms_hash;
      if (!gms) { log(`  no gms_hash: ${JSON.stringify(prod).slice(0, 300)}`); results.push([want, 'no details']); continue; }
      const params = (gms.params || []).map((p) => p[p.length - 1]).join(',');
      const exp = await api('POST', '/animations/export', {
        character_id: cid,
        gms_hash: [{ 'model-id': gms['model-id'], mirror: gms.mirror || false, trim: gms.trim || [0, 100], overdrive: 0, params, 'arm-space': gms['arm-space'] || 0, inplace: true }],
        preferences: { format: 'fbx7_2019', skin: 'false', fps: '30', reducekf: '0' },
        product_name: hit.name, type: 'Motion',
      });
      log(`  export request: status ${exp.status} ${JSON.stringify(exp.json || exp.text).slice(0, 200)}`);
      if (exp.status >= 400) { results.push([want, 'export refused']); continue; }

      let url = null;
      for (let i = 0; i < 60 && !url; i++) {
        await sleep(2000);
        const mon = await api('GET', `/characters/${cid}/monitor`);
        const st = mon.json && mon.json.status;
        if (st === 'completed') url = mon.json.job_result;
        else if (st === 'failed') { log(`  export failed: ${JSON.stringify(mon.json).slice(0, 200)}`); break; }
      }
      if (!url) { results.push([want, 'export failed/timed out']); continue; }

      const res = await net.fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const isZip = buf.slice(0, 2).toString() === 'PK';
      fs.writeFileSync(isZip ? file.replace(/\.fbx$/, '.zip') : file, buf);
      log(`  saved ${path.basename(file)}${isZip ? ' (zip - needs unpacking)' : ''} ${(buf.length / 1024).toFixed(0)} KB`);
      results.push([want, isZip ? 'zip' : 'ok']);
    } catch (e) {
      log(`"${want}" failed: ${e && e.message || e}`);
      results.push([want, 'error']);
    }
    await sleep(1500);
  }
  log('DONE ' + JSON.stringify(results));
  app.quit();
});
