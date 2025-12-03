document.addEventListener('DOMContentLoaded', ()=>{
  // state
  let mediaStream = null;
  let mediaRecorder = null;
  let timerInterval = null;
  let countdown = 4*60*60; // seconds
  let selectedProblemId = 'p1'; // default problem
  let allProblems = {}; // cache all problems
  let currentProblemIndex = 0;
  let examStarted = false;

  // Helper DOM
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const screens = ()=> $$('.screen');
  const showScreen = (id)=>{
    screens().forEach(s=>s.classList.remove('active'));
    const el = document.getElementById(id);
    if(el) el.classList.add('active');
    // when entering exam make sure editor/problem loaded
    if(id === 'exam') loadAndRenderProblem();
  };
  const formatHMS = (s)=>{ const hh = String(Math.floor(s/3600)).padStart(2,'0'); const mm = String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}` };
  const renderTimer = ()=>{ const el = document.getElementById('countdown'); if(el) el.innerText = formatHMS(countdown); };
  function startTimer(){
    if(timerInterval) return;
    renderTimer();
    timerInterval = setInterval(()=>{
      countdown--;
      if(countdown<=0){ clearInterval(timerInterval); timerInterval=null; alert('Time up! Auto submitting'); submit(true); }
      renderTimer();
    },1000);
  }
  function stopTimer(){ if(timerInterval) { clearInterval(timerInterval); timerInterval=null; } }

  // navigation
  const elToInstr = document.getElementById('toInstr'); if(elToInstr) elToInstr.onclick = ()=> showScreen('instructions');
  const elBack = document.getElementById('backToSplash'); if(elBack) elBack.onclick = ()=> showScreen('splash');
  const elOpenRepo = document.getElementById('openRepo'); if(elOpenRepo) elOpenRepo.onclick = ()=> { window.open('../README.md','_blank'); };

  // problem selection flow
  const elStartCam = document.getElementById('startCamera'); if(elStartCam) elStartCam.onclick = ()=> showScreen('selectProblem');
  const elBackInstr = document.getElementById('backToInstructions'); if(elBackInstr) elBackInstr.onclick = ()=> showScreen('instructions');
  const elStartWithSelected = document.getElementById('startWithSelected'); if(elStartWithSelected) elStartWithSelected.onclick = ()=> {
    // ensure a problem is selected; currentProblemIndex set accordingly
    const ids = Object.keys(allProblems);
    currentProblemIndex = Math.max(0, ids.indexOf(selectedProblemId));
    if(currentProblemIndex < 0) currentProblemIndex = 0;
    selectedProblemId = ids[currentProblemIndex];
    showScreen('camera');
  };

  // Camera + recorder
  const elAllowCam = document.getElementById('allowCam');
  if(elAllowCam) elAllowCam.onclick = async ()=>{
    try{
      mediaStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      const preview = document.getElementById('preview');
      if(preview) preview.srcObject = mediaStream;
      const cs = document.getElementById('camStatus'); if(cs) cs.innerText = 'Camera active';
      const css = document.getElementById('camStatusSmall'); if(css) css.innerText = 'active';
      startRecorder();
      // start exam after camera
      examStarted = true;
      startTimer();
      showScreen('exam');
    }catch(e){
      console.warn('getUserMedia failed', e);
      const cs = document.getElementById('camStatus'); if(cs) cs.innerText = 'Camera denied';
      const css = document.getElementById('camStatusSmall'); if(css) css.innerText = 'denied';
      // still proceed to exam (some flows allow skip)
      examStarted = true;
      startTimer();
      showScreen('exam');
    }
  };
  const elSkipCam = document.getElementById('skipCam');
  if(elSkipCam) elSkipCam.onclick = ()=> {
    const cs = document.getElementById('camStatus'); if(cs) cs.innerText='Skipped';
    const css = document.getElementById('camStatusSmall'); if(css) css.innerText='skipped';
    examStarted = true;
    startTimer();
    showScreen('exam');
  };

  function startRecorder(){
    if(!mediaStream) return;
    try{ mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm; codecs=vp9' }); }
    catch(e){ try{ mediaRecorder = new MediaRecorder(mediaStream); } catch(e2){ console.warn('Recorder not available', e2); return; } }
    mediaRecorder.ondataavailable = (e)=>{
      if(e.data && e.data.size>0){
        // upload chunk
        try{
          const fd = new FormData();
          fd.append('chunk', e.data, 'chunk-'+Date.now()+'.webm');
          fetch('/api/recording',{method:'POST',body:fd}).then(r=>r.json()).then(j=>console.log('chunk uploaded',j)).catch(err=>console.warn('upload err',err));
        }catch(err){ console.warn('record upload failed', err); }
      }
    };
    mediaRecorder.onstop = ()=> console.log('rec stopped');
    // slice every 30 seconds
    try{ mediaRecorder.start(30*1000); }catch(e){ try{ mediaRecorder.start(); }catch(e2){ console.warn('rec start failed', e2); } }
  }
  function stopRecorder(){
    try{ if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }catch(e){}
    try{ if(mediaStream) { mediaStream.getTracks().forEach(t=>t.stop()); mediaStream = null; } }catch(e){}
  }

  // Problems — full data (5)
  allProblems = {
    'p1': {
      id: 'p1',
      title: 'Longest Increasing Subsequence (LIS)',
      difficulty: 'Medium',
      description: 'Given an array of integers, compute the length of the longest strictly increasing subsequence and output the subsequence itself on the next line.',
      explanation: 'Use DP with parent pointers (O(n^2)) or patience sorting + parent reconstruction (O(n log n)). Return length and one LIS.',
      examples: [
        { input: '5\\n1 2 3 4 5', output: '5\\n1 2 3 4 5', explanation: 'Already increasing' },
        { input: '6\\n5 2 8 6 3 6', output: '3\\n2 3 6', explanation: 'Typical case' }
      ],
      shownTests:[
        { input: '5\\n1 2 3 4 5', expected: '5\\n1 2 3 4 5' },
        { input: '6\\n5 2 8 6 3 6', expected: '3\\n2 3 6' },
        { input: '4\\n4 3 2 1', expected: '1\\n4' },
        { input: '8\\n10 9 2 5 3 7 101 18', expected: '4\\n2 5 7 101' }
      ],
      starterJS: `function solve(input){ input = input.trim().split(/\\s+/).map(Number); const n = input[0]; const arr = input.slice(1,1+n); let dp=new Array(n).fill(1), parent=new Array(n).fill(-1); let best=0, idx=0; for(let i=0;i<n;i++){ for(let j=0;j<i;j++){ if(arr[j]<arr[i] && dp[j]+1>dp[i]){ dp[i]=dp[j]+1; parent[i]=j; } } if(dp[i]>best){best=dp[i]; idx=i; } } let seq=[]; while(idx!=-1){ seq.push(arr[idx]); idx=parent[idx]; } seq.reverse(); return best + "\\n" + seq.join(' '); }`
    },
    'p2': {
      id: 'p2',
      title: 'Two Sum (variant: return indices)',
      difficulty: 'Medium',
      description: 'Given array nums and target, return indices of the two numbers such that they add up to target.',
      explanation: 'Use hash map for O(n) solution.',
      examples:[ {input:'nums=[2,7,11,15], target=9', output:'[0,1]'} ],
      shownTests:[
        { input: 'JSON\\n{"nums":[2,7,11,15],"target":9}', expected: '[0,1]' },
        { input: 'JSON\\n{"nums":[3,2,4],"target":6}', expected: '[1,2]' }
      ],
      starterJS: `function solve(input){ try{ const raw = input.trim(); if(raw.startsWith('JSON')){ const j = JSON.parse(raw.replace(/^JSON\\n/,'')); const nums = j.nums; const target = j.target; const map = new Map(); for(let i=0;i<nums.length;i++){ const need = target-nums[i]; if(map.has(need)) return JSON.stringify([map.get(need), i]); map.set(nums[i], i); } return '[]'; } else { return 'Invalid input'; } }catch(e){ return String(e); } }`
    },
    'p3': {
      id: 'p3',
      title: 'Word Ladder (Shortest Transformation Length)',
      difficulty: 'Hard',
      description: 'Given beginWord, endWord, and wordList, return the number of words in the shortest transformation sequence from beginWord to endWord, or 0 if none.',
      explanation: 'BFS or bidirectional BFS over word graph where neighbors differ by one letter.',
      examples:[ {input:'{"beginWord":"hit","endWord":"cog","wordList":["hot","dot","dog","lot","log","cog"]}', output:'5'} ],
      shownTests:[
        { input: '{"beginWord":"hit","endWord":"cog","wordList":["hot","dot","dog","lot","log","cog"]}', expected: '5' },
        { input: '{"beginWord":"hit","endWord":"cog","wordList":["hot","dot","dog","lot","log"]}', expected: '0' }
      ],
      starterJS: `function solve(input){ const o = JSON.parse(input); const begin=o.beginWord,end=o.endWord,list=o.wordList; const set=new Set(list); if(!set.has(end)) return '0'; let q=[begin], steps=1, L=begin.length; const visited=new Set([begin]); while(q.length){ const nq=[]; for(const w of q){ if(w===end) return String(steps); for(let i=0;i<L;i++){ for(let c=97;c<=122;c++){ const ch=String.fromCharCode(c); if(ch===w[i]) continue; const nw = w.slice(0,i)+ch+w.slice(i+1); if(set.has(nw) && !visited.has(nw)){ visited.add(nw); nq.push(nw); } } } } q=nq; steps++; } return '0'; }`
    },
    'p4': {
      id: 'p4',
      title: 'Maximum Product Subarray',
      difficulty: 'Medium',
      description: 'Find the contiguous subarray within an array (containing at least one number) which has the largest product.',
      explanation: 'Track max/min product ending at each position because negative numbers flip sign.',
      examples:[ {input:'[2,3,-2,4]', output:'6'} ],
      shownTests:[
        { input: '[2,3,-2,4]', expected: '6' },
        { input: '[-2,0,-1]', expected: '0' }
      ],
      starterJS: `function solve(input){ const arr = JSON.parse(input); let maxProd=arr[0], minProd=arr[0], ans=arr[0]; for(let i=1;i<arr.length;i++){ const x=arr[i]; const candidates=[x, x*maxProd, x*minProd]; maxProd=Math.max(...candidates); minProd=Math.min(...candidates); ans=Math.max(ans,maxProd); } return String(ans); }`
    },
    'p5': {
      id: 'p5',
      title: 'Median of Two Sorted Arrays',
      difficulty: 'Hard',
      description: 'Given two sorted arrays nums1 and nums2 of size m and n, return the median of the two sorted arrays in O(log(min(m,n))).',
      explanation: 'Binary search on partition index of the smaller array.',
      examples:[ {input:'{"nums1":[1,3],"nums2":[2]}', output:'2'} ],
      shownTests:[
        { input: '{"nums1":[1,3],"nums2":[2]}', expected: '2' },
        { input: '{"nums1":[1,2],"nums2":[3,4]}', expected: '2.5' }
      ],
      starterJS: `function solve(input){ const o=JSON.parse(input); let A=o.nums1||[], B=o.nums2||[]; if(A.length>B.length) return solve(JSON.stringify({nums1:B,nums2:A})); const m=A.length,n=B.length,half=Math.floor((m+n+1)/2); let l=0,r=m; while(l<=r){ const i=Math.floor((l+r)/2); const j=half-i; const Aleft = i>0?A[i-1]:-Infinity; const Aright = i<m?A[i]:Infinity; const Bleft = j>0?B[j-1]:-Infinity; const Bright = j<n?B[j]:Infinity; if(Aleft<=Bright && Bleft<=Aright){ if((m+n)%2===1) return String(Math.max(Aleft,Bleft)); const median = (Math.max(Aleft,Bleft)+Math.min(Aright,Bright))/2; return String(median); } else if(Aleft>Bright) r=i-1; else l=i+1; } return '0'; }`
    }
  };

  // render sidebar list
  function renderProblemList(){
    const sidebar = document.getElementById('problemListSidebar');
    if(!sidebar) return;
    sidebar.innerHTML = '';
    const arr = Object.values(allProblems);
    arr.forEach((p, idx)=>{
      const item = document.createElement('div');
      item.className = 'problem-list-item';
      item.style.cssText = 'padding:10px;border-radius:4px;cursor:pointer;margin-bottom:6px;border-left:3px solid transparent;transition:all 0.15s;';
      item.innerHTML = `<div style="font-weight:600;font-size:13px;">${idx+1}. ${p.title}</div><div class="muted" style="font-size:11px;margin-top:2px;">${p.difficulty || 'Medium'}</div>`;
      item.onclick = ()=>{
        // clear previous selected visuals
        $$('.problem-list-item').forEach(el=>{ el.style.borderLeftColor='transparent'; el.style.backgroundColor='transparent'; });
        item.style.borderLeftColor = '#0099cc'; item.style.backgroundColor='#f0f8ff';
        selectedProblemId = p.id;
        currentProblemIndex = idx;
        renderProblemDetails(p);
      };
      sidebar.appendChild(item);
    });
    // auto-select first if none selected
    if(Object.keys(allProblems).length>0){
      const first = Object.values(allProblems)[0];
      selectedProblemId = first.id;
      currentProblemIndex = 0;
      renderProblemDetails(first);
      const firstEl = sidebar.firstChild;
      if(firstEl){ firstEl.style.borderLeftColor='#0099cc'; firstEl.style.backgroundColor='#f0f8ff'; }
    }
  }

  function renderProblemDetails(p){
    const panel = document.getElementById('problemDetailsPanel');
    if(!panel) return;
    const examplesHtml = (p.examples || []).map((ex,i)=>`
      <div style="background:#f5f5f5;padding:10px;border-radius:4px;margin:8px 0;border-left:3px solid #0099cc;">
        <strong>Example ${i+1}:</strong><br/>
        <div style="font-family:monospace;font-size:12px;margin:6px 0;white-space:pre-wrap;word-break:break-all;">${ex.input.replace(/</g,'&lt;')}</div>
        <strong>Output:</strong> <code style="font-family:monospace;background:#fff;padding:2px 4px;border-radius:2px;">${ex.output.replace(/</g,'&lt;')}</code><br/>
        <div class="muted" style="font-size:12px;margin-top:4px;">${ex.explanation || ''}</div>
      </div>
    `).join('');
    panel.innerHTML = `
      <h3 style="margin-top:0;color:#333;">${p.title}</h3>
      <div style="background:#fff9e6;padding:8px;border-radius:4px;margin-bottom:12px;border-left:3px solid #ffa500;font-size:13px;">
        <strong>Difficulty:</strong> ${p.difficulty || 'Medium'} | <strong>Status:</strong> ${selectedProblemId === p.id ? '✓ Selected' : 'Not selected'}
      </div>
      <div style="margin-bottom:12px;line-height:1.6;">
        <strong>Description:</strong><br/>
        ${p.description || 'No description available'}
      </div>
      <div style="margin-bottom:12px;">
        <strong>Examples:</strong>
        ${examplesHtml}
      </div>
      <div style="background:#e8f4f8;padding:10px;border-radius:4px;margin-top:12px;border-left:3px solid #0099cc;font-size:12px;line-height:1.5;">
        <strong>Approach:</strong><br/>
        ${p.explanation || 'Use a suitable algorithm to solve this problem.'}
      </div>
    `;
  }

  // exam area render
  async function loadAndRenderProblem(){
    // if server provides detailed problem, try fetch; otherwise use local allProblems
    try{
      const r = await fetch('/api/problem/'+selectedProblemId);
      if(r.ok){
        const j = await r.json();
        if(j && j.problem){
          // merge server problem into local store (but fallback to local fields)
          allProblems[selectedProblemId] = Object.assign({}, allProblems[selectedProblemId] || {}, j.problem);
        }
      }
    }catch(e){ /* ignore */ }

    const p = allProblems[selectedProblemId] || Object.values(allProblems)[currentProblemIndex];
    if(!p) return;
    // set title/desc/examples
    const titleEl = document.getElementById('problemTitle'); if(titleEl) titleEl.innerText = `Problem: ${p.title}`;
    const descEl = document.getElementById('problemDesc'); if(descEl) descEl.innerHTML = `<div style='font-size:14px;line-height:1.6;'>${(p.description||'Loading...').replace(/\\n/g,'<br>')}</div>`;
    const exEl = document.getElementById('examples'); if(exEl){
      exEl.innerHTML = '';
      (p.examples || []).forEach((ex,i)=>{
        const d = document.createElement('div');
        d.className = 'example';
        d.innerHTML = `<div><strong>Example ${i+1}:</strong><br/><div style='font-family:monospace;font-size:12px;background:#f5f5f5;padding:6px;border-radius:4px;margin:4px 0;white-space:pre-wrap;'>${ex.input.replace(/</g,'&lt;')}</div><div style='margin:4px 0;'><strong>Output:</strong> <code style='font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:3px;'>${ex.output.replace(/</g,'&lt;')}</code></div><div class='muted' style='font-size:12px;'>${ex.explanation||''}</div></div>`;
        exEl.appendChild(d);
      });
    }
    // shown tests list
    renderShown(p);
    // load editor code from localStorage if exists, else use starterJS if any
    const editor = document.getElementById('editor');
    if(editor){
      const key = `ycp_code_${p.id}`;
      const saved = localStorage.getItem(key);
      if(saved) editor.value = saved;
      else if(p.starterJS) editor.value = p.starterJS;
      editor.oninput = ()=> localStorage.setItem(key, editor.value);
    }
    // update submit button text (Next or Submit & Finish)
    const submitBtn = document.getElementById('submitAll');
    if(submitBtn){
      if(currentProblemIndex < Object.values(allProblems).length - 1) submitBtn.textContent = 'Next Problem';
      else submitBtn.textContent = 'Submit & Finish';
    }
  }

  function renderShown(p){
    const c = document.getElementById('shownTests');
    if(!c) return;
    c.innerHTML = '';
    (p.shownTests||[]).forEach((t,i)=>{
      const div = document.createElement('div');
      div.className = 'test-row';
      div.style.borderBottom='1px solid #eee'; div.style.padding='8px 0';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><div><strong>Test ${i+1}</strong> <span class="muted" style="margin-left:8px;">input:</span> <code style="font-family:Source Code Pro; font-size:12px; color:var(--muted);">${t.input.replace(/\\n/g,'↵')}</code></div><div id="tres${i}" class="muted">Not run</div></div>`;
      c.appendChild(div);
    });
  }

  // initial render of problem list
  renderProblemList();

  // run shown tests (server then fallback to local JS)
  const runLocalJS = (source, tests)=>{
    try{
      const wrapped = `(function(){\n${source}\n return typeof solve === 'function' ? solve : null;\n})();`;
      const solve = (0, eval)(wrapped); // indirect eval in global scope
      if(typeof solve !== 'function') return null;
      return tests.map(t=>{
        try{ const out = String(solve(t.input)); const ok = out.trim() === String(t.expected).trim(); return { ok, out }; } catch(e){ return { ok:false, error:String(e) }; }
      });
    }catch(e){ console.warn('local eval failed', e); return null; }
  };

  const runBtn = document.getElementById('runTests');
  if(runBtn) runBtn.onclick = async ()=>{
    const editor = document.getElementById('editor');
    const src = editor ? editor.value : '';
    const lang = document.getElementById('language') ? document.getElementById('language').value : 'javascript';
    const status = document.getElementById('lastStatus'); if(status) status.innerText = 'Running shown tests...';
    // try server
    try{
      const resp = await fetch('/api/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user:'demo', problemId:selectedProblemId, language:lang, source:src, runShownOnly:true })});
      if(resp.ok){
        const j = await resp.json();
        if(j && j.ok && j.shownResults){
          j.shownResults.forEach((r,i)=>{ const el = document.getElementById('tres'+i); if(el){ el.innerText = r.ok ? 'PASS' : 'FAIL'; el.className = r.ok ? 'test-pass' : 'test-fail'; } });
          if(status) status.innerText = 'Shown tests completed (server)';
          return;
        }
      }
    }catch(e){ console.warn('server shown tests failed', e); }
    // fallback to local JS run
    if(lang === 'javascript'){
      const p = allProblems[selectedProblemId];
      const results = runLocalJS(src, (p && p.shownTests) ? p.shownTests : []);
      if(results){
        results.forEach((r,i)=>{ const el = document.getElementById('tres'+i); if(el) { el.innerText = r.ok ? 'PASS' : 'FAIL'; el.className = r.ok ? 'test-pass' : 'test-fail'; }});
        if(status) status.innerText = 'Shown tests completed (local)';
        return;
      }
    }
    if(status) status.innerText = 'Failed to run shown tests';
    alert('Could not run tests. Server unreachable and no local runner available for selected language.');
  };

  // submit — either Next or final
  async function submit(auto=false){
    // if not auto and user cancels, abort
    const editor = document.getElementById('editor');
    const src = editor ? editor.value : '';
    const lang = document.getElementById('language') ? document.getElementById('language').value : 'javascript';
    const status = document.getElementById('lastStatus'); if(status) status.innerText = 'Submitting...';
    // determine if final or next
    const total = Object.values(allProblems).length;
    const isFinal = currentProblemIndex >= total-1;
    // try server submit (best effort)
    try{
      const resp = await fetch('/api/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user:'demo', problemId:selectedProblemId, language:lang, source:src, final:isFinal })});
      if(resp.ok){
        const j = await resp.json();
        if(j && j.ok){
          // mark shownResults if available
          if(j.shownResults){
            j.shownResults.forEach((r,i)=>{ const el = document.getElementById('tres'+i); if(el){ el.innerText = r.ok ? 'PASS' : 'FAIL'; el.className = r.ok ? 'test-pass' : 'test-fail'; }});
            const passed = (j.shownResults||[]).filter(x=>x.ok).length;
            const tot = (j.shownResults||[]).length;
            const shownResEl = document.getElementById('shownTestsResult'); if(shownResEl) shownResEl.innerText = `${passed}/${tot} test(s) passed`;
          }
          // if final, show thank you
          if(isFinal){
            // stop timer & recorder
            stopTimer(); stopRecorder();
            // fill summary
            const submissionId = j.submissionId || ('SUB-'+Date.now());
            const summary = document.getElementById('summary');
            if(summary) summary.innerHTML = `<p><strong>Submission ID:</strong> <span style="font-family:monospace">${submissionId}</span></p><p><strong>Problem:</strong> ${allProblems[selectedProblemId].title}</p><p><strong>Language:</strong> ${lang}</p>`;
            showScreen('thankyou');
            return;
          } else {
            // Next: increment index and load next problem
            currentProblemIndex = Math.min(total-1, currentProblemIndex+1);
            selectedProblemId = Object.keys(allProblems)[currentProblemIndex];
            loadAndRenderProblem();
            // update sidebar visual
            $$('.problem-list-item').forEach((el,i)=>{ el.style.borderLeftColor = (i===currentProblemIndex)?'#0099cc':'transparent'; el.style.backgroundColor = (i===currentProblemIndex)?'#f0f8ff':'transparent'; });
            if(status) status.innerText = 'Submitted (server). Moved to next problem.';
            return;
          }
        }
      }
    }catch(e){ console.warn('server submit failed', e); }

    // server failed -> store draft locally and simulate Next/Final
    try{ localStorage.setItem(`ycp_submission_draft_${selectedProblemId}`, JSON.stringify({source:src, language:lang, time:Date.now()})); }catch(e){}
    if(isFinal){
      stopTimer(); stopRecorder();
      const summary = document.getElementById('summary');
      if(summary) summary.innerHTML = `<p><strong>Submission ID:</strong> <span style="font-family:monospace">LOCAL-${Date.now()}</span></p><p><strong>Problem:</strong> ${allProblems[selectedProblemId].title}</p><p><strong>Language:</strong> ${lang}</p><p style="color:#856404">Results will be available on Friday.</p>`;
      showScreen('thankyou');
      if(status) status.innerText = 'Submitted locally (server unreachable).';
      return;
    } else {
      currentProblemIndex = Math.min(Object.keys(allProblems).length-1, currentProblemIndex+1);
      selectedProblemId = Object.keys(allProblems)[currentProblemIndex];
      loadAndRenderProblem();
      if(status) status.innerText = 'Saved locally and moved to next problem (server unreachable).';
      return;
    }
  }

  const elSubmitAll = document.getElementById('submitAll'); if(elSubmitAll) elSubmitAll.onclick = ()=> submit(false);

  // download report from Thankyou page
  const elDownload = document.getElementById('downloadReport'); if(elDownload) elDownload.onclick = ()=>{
    const summary = document.getElementById('summary');
    const txt = summary ? summary.innerText : '{}';
    const blob = new Blob([txt], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'submission_report.txt';
    a.click();
  };

  const elRestart = document.getElementById('restart'); if(elRestart) elRestart.onclick = ()=> location.reload();

  // theme toggle
  const themeToggle = document.getElementById('themeToggle');
  let dark = true;
  if(themeToggle) themeToggle.onclick = ()=>{ dark = !dark; document.documentElement.style.filter = dark ? 'none' : 'brightness(1.08) saturate(.9)'; themeToggle.textContent = dark ? '🌙' : '🌤️'; };

  // init
  renderTimer();
  renderProblemList();

  // export helpers for debug
  window._ycp = { startTimer, submit, allProblems };

});
