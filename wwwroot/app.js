const builtIn={
"たべる":{word:"たべる",reading:"たべる",romaji:"taberu",meaning:"לאכול",sentence:"わたしは りんごを たべる。",translation:"אני אוכלת תפוח.",note:"פועל בסיסי בצורת מילון.",parts:["た","べ","る"]},
"みず":{word:"みず",reading:"みず",romaji:"mizu",meaning:"מים",sentence:"みずを のみます。",translation:"אני שותה מים.",note:"を מסמן את מושא הפעולה.",parts:["み","ず"]},
"ねこ":{word:"ねこ",reading:"ねこ",romaji:"neko",meaning:"חתול",sentence:"ねこが います。",translation:"יש חתול.",note:"が מסמן כאן את הדבר שקיים.",parts:["ね","こ"]},
"ありがとう":{word:"ありがとう",reading:"ありがとう",romaji:"arigatou",meaning:"תודה",sentence:"ありがとう ございます。",translation:"תודה רבה.",note:"ございます הופך את הביטוי למנומס יותר.",parts:["あ","り","が","と","う"]},
"がっこう":{word:"がっこう",reading:"がっこう",romaji:"gakkou",meaning:"בית ספר",sentence:"がっこうへ いきます。",translation:"אני הולכת לבית הספר.",note:"っ הקטנה יוצרת עצירה קצרה.",parts:["が","っ","こ","う"]},
"せんせい":{word:"せんせい",reading:"せんせい",romaji:"sensei",meaning:"מורה",sentence:"せんせいは やさしいです。",translation:"המורה נחמד/ה.",note:"は מסמן את נושא המשפט.",parts:["せ","ん","せ","い"]},
"ともだち":{word:"ともだち",reading:"ともだち",romaji:"tomodachi",meaning:"חבר / חברה",sentence:"ともだちと はなします。",translation:"אני מדברת עם חברה.",note:"と יכול לציין עם.",parts:["と","も","だ","ち"]},
"ほん":{word:"ほん",reading:"ほん",romaji:"hon",meaning:"ספר",sentence:"ほんを よみます。",translation:"אני קוראת ספר.",note:"よみます פירושו קוראת.",parts:["ほ","ん"]},
"よむ":{word:"よむ",reading:"よむ",romaji:"yomu",meaning:"לקרוא",sentence:"まんがを よむ。",translation:"אני קוראת מנגה.",note:"צורת המילון של הפועל.",parts:["よ","む"]},
"みる":{word:"みる",reading:"みる",romaji:"miru",meaning:"לראות / לצפות",sentence:"えいがを みる。",translation:"אני צופה בסרט.",note:"פועל נפוץ מאוד.",parts:["み","る"]},
"にほんご":{word:"にほんご",reading:"にほんご",romaji:"nihongo",meaning:"יפנית",sentence:"にほんごを べんきょうします。",translation:"אני לומדת יפנית.",note:"ご מציין כאן שפה.",parts:["に","ほ","ん","ご"]},
"かわいい":{word:"かわいい",reading:"かわいい",romaji:"kawaii",meaning:"חמוד/ה",sentence:"この ねこは かわいいです。",translation:"החתול הזה חמוד.",note:"תואר נפוץ מאוד.",parts:["か","わ","い","い"]}
};

const CUSTOM_KEY="jsn-custom-v4";
const SAVED_KEY="jsn-saved-v4";
const AI_HISTORY_KEY="jsn-ai-history-v4";
const AI_CACHE_KEY="jsn-ai-cache-v6";
let editingKey=null;
let activeAnalysisController=null;
let stopProgressAnimation=null;

const $=id=>document.getElementById(id);
const views={study:$("studyView"),ai:$("aiView"),manual:$("manualView"),saved:$("savedView")};

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function custom(){return read(CUSTOM_KEY,{})}
function dictionary(){return {...builtIn,...custom()}}
function saved(){return read(SAVED_KEY,[])}
function normalize(v){return v.trim()}
function switchView(name){
  Object.entries(views).forEach(([key,el])=>el.classList.toggle("hidden",key!==name));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  if(name==="saved")renderSaved();
}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.view));

function speak(text){
  if(!("speechSynthesis"in window)){alert("הדפדפן אינו תומך בהשמעה.");return}
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang="ja-JP";u.rate=.72;
  const v=speechSynthesis.getVoices().find(x=>(x.lang||"").toLowerCase().startsWith("ja"));
  if(v)u.voice=v;speechSynthesis.speak(u)
}

function toggleSaved(key){
  const s=saved();
  write(SAVED_KEY,s.includes(key)?s.filter(x=>x!==key):[key,...s]);
  renderSaved();
}

function showStudy(raw){
  const key=normalize(raw),item=dictionary()[key];
  switchView("study");
  if(!item){$("studyResult").innerHTML='<div class="result-empty"><strong>המילה עדיין לא נמצאת במאגר.</strong><br>אפשר לנתח אותה ב-AI או להוסיף אותה ידנית.</div>';return}
  $("searchInput").value=key;
  const isSaved=saved().includes(key),isCustom=Object.hasOwn(custom(),key);
  $("studyResult").innerHTML=`
  <div class="title-row">
    <div>
      <h2 class="jp-main">${esc(item.word||key)}</h2>
      <div class="reading">${esc(item.reading||key)}</div>
      <div class="romaji">${esc(item.romaji)}</div>
    </div>
    <div class="actions">
      <button class="secondary" id="studySpeak">🔊 השמעה</button>
      <button class="ghost" id="studySave">${isSaved?"✓ נשמר":"＋ שמירה"}</button>
      ${isCustom?'<button class="ghost" id="studyEdit">✎ עריכה</button><button class="danger" id="studyDelete">מחיקה</button>':""}
    </div>
  </div>
  <div class="grid">
    <div class="box"><div class="label">משמעות בעברית</div><div class="value">${esc(item.meaning)}</div></div>
    <div class="box"><div class="label">פירוק לצלילים</div><div class="value jp">${(item.parts||Array.from(item.reading||key)).map(esc).join("・")}</div></div>
    <div class="box full"><div class="label">משפט לדוגמה</div><div class="value jp">${esc(item.sentence)}</div><button class="secondary" id="sentenceSpeak" style="margin-top:10px">🔊 השמעת המשפט</button></div>
    <div class="box"><div class="label">תרגום המשפט</div><div class="value">${esc(item.translation)}</div></div>
    <div class="box"><div class="label">הסבר קצר</div><div class="value" style="font-size:18px">${esc(item.note||"")}</div></div>
  </div>`;
  $("studySpeak").onclick=()=>speak(item.word||key);
  $("sentenceSpeak").onclick=()=>speak(item.sentence);
  $("studySave").onclick=()=>{toggleSaved(key);showStudy(key)};
  if(isCustom){
    $("studyEdit").onclick=()=>startEdit(key);
    $("studyDelete").onclick=()=>deleteCustom(key);
  }
}
$("searchButton").onclick=()=>showStudy($("searchInput").value);
$("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")showStudy($("searchInput").value)});
document.querySelectorAll("[data-word]").forEach(b=>b.onclick=()=>showStudy(b.dataset.word));

function renderSaved(){
  const all=dictionary(),s=saved();
  if(!s.length){$("savedList").innerHTML='<div class="result-empty">עדיין לא נשמרו מילים.</div>';return}
  $("savedList").innerHTML=s.filter(k=>all[k]).map(k=>{
    const i=all[k],isCustom=Object.hasOwn(custom(),k);
    return `<div class="saved-item" data-open="${esc(k)}">
      <div class="saved-main"><span class="saved-jp">${esc(i.word||k)}</span><span>${esc(i.meaning)}</span><span class="badge">${esc(i.romaji)}</span>${isCustom?'<span class="badge custom">אישי</span>':""}</div>
      <button class="ghost" data-remove="${esc(k)}">✕</button>
    </div>`
  }).join("");
  document.querySelectorAll("[data-open]").forEach(el=>el.onclick=e=>{if(e.target.closest("[data-remove]"))return;showStudy(el.dataset.open);window.scrollTo({top:0,behavior:"smooth"})});
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{toggleSaved(b.dataset.remove);renderSaved()});
}
$("clearSaved").onclick=()=>{if(saved().length&&confirm("לנקות את רשימת הלימוד?")){write(SAVED_KEY,[]);renderSaved()}};

function formValues(){
  const word=normalize($("manualWord").value);
  return {
    word,reading:normalize($("manualReading").value),romaji:$("manualRomaji").value.trim(),
    meaning:$("manualMeaning").value.trim(),sentence:$("manualSentence").value.trim(),
    translation:$("manualTranslation").value.trim(),note:$("manualNote").value.trim(),
    parts:Array.from(normalize($("manualReading").value))
  }
}
function validateManual(msg,type){const v=$("manualValidation");v.textContent=msg;v.className=`validation show ${type}`}
function resetManual(){editingKey=null;$("manualForm").reset();$("manualTitle").textContent="הוספת מילה ידנית";$("manualValidation").className="validation"}
function startEdit(key){
  const i=custom()[key];if(!i)return;editingKey=key;
  $("manualTitle").textContent="עריכת מילה";
  $("manualWord").value=i.word||key;$("manualReading").value=i.reading||"";
  $("manualRomaji").value=i.romaji||"";$("manualMeaning").value=i.meaning||"";
  $("manualSentence").value=i.sentence||"";$("manualTranslation").value=i.translation||"";
  $("manualNote").value=i.note||"";switchView("manual")
}
function deleteCustom(key){
  if(!confirm(`למחוק את ${key}?`))return;
  const c=custom();delete c[key];write(CUSTOM_KEY,c);write(SAVED_KEY,saved().filter(x=>x!==key));
  $("studyResult").innerHTML='<div class="result-empty">המילה נמחקה.</div>'
}
$("manualForm").onsubmit=e=>{
  e.preventDefault();const i=formValues();
  if(!i.word||!i.reading||!i.romaji||!i.meaning||!i.sentence||!i.translation){validateManual("יש למלא את כל שדות החובה.","error");return}
  const c=custom();
  if(!editingKey&&Object.hasOwn(dictionary(),i.word)){validateManual("המילה כבר קיימת.","error");return}
  if(editingKey&&editingKey!==i.word)delete c[editingKey];
  c[i.word]=i;write(CUSTOM_KEY,c);
  if(!saved().includes(i.word))write(SAVED_KEY,[i.word,...saved()]);
  validateManual("המילה נשמרה.","ok");
  const key=i.word;setTimeout(()=>{resetManual();showStudy(key)},350)
};
$("cancelManual").onclick=()=>{resetManual();switchView("study")};

function displayAI(data,meta={}){
  const corrected=data.sourceLanguage==="japanese"&&(!data.isNaturalJapanese||data.original.trim()!==data.correctedJapanese.trim());
  const statusText=data.sourceLanguage==="hebrew"?"תורגם מעברית ליפנית":data.sourceLanguage==="other"?"תורגם ליפנית":corrected?"בוצע תיקון קל":"יפנית טבעית";
  const parts=(data.parts||[]).map(p=>`<div class="part">
    <div><div class="part-jp">${esc(p.japanese)}</div><div class="part-reading">${esc(p.hiragana)} · ${esc(p.romaji)}</div></div>
    <div>${esc(p.meaningHebrew)}</div><div><div class="part-function">${esc(p.functionHebrew)}</div></div>
  </div>`).join("");
  const grammar=(data.grammarPoints||[]).length?(data.grammarPoints||[]).map(g=>`<div class="grammar"><strong class="jp">${esc(g.form)}</strong><br>${esc(g.explanationHebrew)}</div>`).join(""):'<div class="result-empty" style="padding:10px">אין נקודת דקדוק מיוחדת.</div>';
  $("aiResult").innerHTML=`
  <div class="title-row">
    <div><h2 class="jp-main">${esc(data.correctedJapanese)}</h2><div class="reading">${esc(data.hiraganaReading)}</div><div class="romaji">${esc(data.romaji)}</div><span class="status ${corrected?"corrected":""}">${statusText}</span>${meta.elapsedSeconds?`<span class="result-meta">הושלם בתוך ${meta.elapsedSeconds} שניות</span>`:""}</div>
    <div class="actions"><button class="secondary" id="aiSpeak">🔊 השמעה</button><button class="primary" id="saveAI">＋ שמור לאוצר המילים</button></div>
  </div>
  <div class="grid">
    <div class="box"><div class="label">תרגום</div><div class="value">${esc(data.hebrewTranslation)}</div></div>
    <div class="box"><div class="label">הסבר פשוט</div><div class="value" style="font-size:18px">${esc(data.shortExplanationHebrew)}</div></div>
    <div class="box full"><div class="label">פירוק</div><div class="parts">${parts}</div></div>
    <div class="box full"><div class="label">דקדוק וחיבורים</div><div class="grammar-list">${grammar}</div></div>
    <div class="box full"><div class="label">משפט נוסף לתרגול</div><div class="example"><div class="value jp">${esc(data.exampleJapanese)}</div><div class="reading">${esc(data.exampleHiragana)}</div><div class="romaji">${esc(data.exampleRomaji)}</div><div style="margin-top:9px">${esc(data.exampleHebrew)}</div><button class="secondary" id="aiExampleSpeak" style="margin-top:12px">🔊 השמעה</button></div></div>
    <div class="box full"><div class="label">טיפ ללמידה</div><div class="value" style="font-size:18px">${esc(data.learningTipHebrew)}</div></div>
  </div>`;
  $("aiSpeak").onclick=()=>speak(data.correctedJapanese);
  $("aiExampleSpeak").onclick=()=>speak(data.exampleJapanese);
  $("saveAI").onclick=()=>saveAIAsEntry(data)
}
function saveAIAsEntry(data){
  const key=data.correctedJapanese.trim(),c=custom();
  c[key]={
    word:key,reading:data.hiraganaReading,romaji:data.romaji,meaning:data.hebrewTranslation,
    sentence:data.exampleJapanese,translation:data.exampleHebrew,
    note:data.shortExplanationHebrew+" "+data.learningTipHebrew,
    parts:(data.parts||[]).map(p=>p.hiragana||p.japanese)
  };
  write(CUSTOM_KEY,c);
  if(!saved().includes(key))write(SAVED_KEY,[key,...saved()]);
  alert("נשמר באוצר המילים.");
}

function normalizeCacheKey(text){
  return text.trim().replace(/\s+/g," ");
}
function getCachedAnalysis(text){
  const cache=read(AI_CACHE_KEY,{});
  return cache[normalizeCacheKey(text)]||null;
}
function saveCachedAnalysis(text,data){
  const key=normalizeCacheKey(text);
  const cache=read(AI_CACHE_KEY,{});
  cache[key]={data,savedAt:Date.now()};
  const trimmed=Object.entries(cache)
    .sort((a,b)=>(b[1].savedAt||0)-(a[1].savedAt||0))
    .slice(0,40);
  write(AI_CACHE_KEY,Object.fromEntries(trimmed));
}
function progressStepsFor(text){
  const hasHebrew=/[֐-׿]/.test(text);
  const hasJapanese=/[぀-ヿ㐀-鿿]/.test(text);
  if(hasHebrew){
    return [
      "קורא את הטקסט שהוזן",
      "מזהה שהקלט כתוב בעברית",
      "מכין תרגום טבעי ליפנית",
      "מפרק את היפנית למילים ולחלקיקים",
      "מכין קריאה בהיראגנה והגייה",
      "מסביר את המבנה ומכין משפט לתרגול",
      "מסדר את דף הלימוד"
    ];
  }
  if(hasJapanese){
    return [
      "קורא את הטקסט היפני",
      "מזהה אם זו מילה, ביטוי או משפט",
      "בודק את הניסוח והכתיבה",
      "מפרק למילים ולחלקיקים",
      "מכין קריאה בהיראגנה והגייה",
      "מסביר את המבנה ומכין משפט לתרגול",
      "מסדר את דף הלימוד"
    ];
  }
  return [
    "קורא את הטקסט",
    "מזהה את שפת הקלט",
    "מכין תרגום טבעי ליפנית",
    "מפרק למילים ולחלקיקים",
    "מכין קריאה והגייה",
    "מכין הסבר ומשפט לתרגול",
    "מסדר את דף הלימוד"
  ];
}
function startProgress(text,controller){
  const steps=progressStepsFor(text);
  const started=Date.now();
  let current=0;
  const timings=[0,900,2200,4200,6800,9800,13500];

  $("aiResult").innerHTML=`
    <div class="progress-shell">
      <div class="progress-top">
        <div class="progress-orb" aria-hidden="true"></div>
        <div>
          <div class="progress-title" id="progressTitle">מתחיל לנתח…</div>
          <div class="progress-subtitle" id="progressSubtitle">מכין עבורך דף לימוד מלא וברור.</div>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <div class="progress-steps">
        ${steps.map((step,index)=>`
          <div class="progress-step ${index===0?"active":""}" data-progress-step="${index}">
            <div class="progress-step-icon">${index===0?"•":index+1}</div>
            <div>${esc(step)}</div>
          </div>`).join("")}
      </div>
      <div class="progress-bottom">
        <div class="progress-time" id="progressTime">עברו 0 שניות</div>
        <button class="ghost" id="cancelAnalysis">ביטול</button>
      </div>
      <div class="progress-hint">המערכת מכינה את כל חלקי ההסבר בבקשה אחת. הכיתובים מציגים מה נכנס לדף הלימוד בזמן ההמתנה.</div>
    </div>`;

  $("cancelAnalysis").onclick=()=>controller.abort();

  const setStep=index=>{
    current=Math.min(index,steps.length-1);
    document.querySelectorAll("[data-progress-step]").forEach((el,i)=>{
      el.classList.toggle("active",i===current);
      el.classList.toggle("done",i<current);
      const icon=el.querySelector(".progress-step-icon");
      if(icon)icon.textContent=i<current?"✓":i===current?"•":String(i+1);
    });
    const fill=$("progressFill");
    if(fill)fill.style.width=`${Math.max(8,((current+1)/steps.length)*92)}%`;
    const title=$("progressTitle");
    if(title)title.textContent=steps[current];
  };

  const stepTimers=timings.slice(1).map((delay,index)=>
    setTimeout(()=>setStep(index+1),delay)
  );

  const clock=setInterval(()=>{
    const seconds=Math.floor((Date.now()-started)/1000);
    const time=$("progressTime");
    if(time)time.textContent=`עברו ${seconds} שניות`;
    const subtitle=$("progressSubtitle");
    if(subtitle&&seconds>=25)subtitle.textContent="עדיין עובד — ההסבר המלא כולל כמה רכיבים.";
    else if(subtitle&&seconds>=15)subtitle.textContent="כמעט מוכן — מסיים לארגן את התוצאה.";
  },1000);

  return ()=>{
    stepTimers.forEach(clearTimeout);
    clearInterval(clock);
  };
}

async function readApiResponse(response){
  const raw=await response.text();
  if(!raw)return {};
  try{return JSON.parse(raw)}catch{return {error:`השרת החזיר תשובה לא תקינה (${response.status}).`}}
}
async function analyze(){
  const text=$("aiInput").value.trim();
  if(!text){$("aiResult").innerHTML='<div class="error">יש להזין מילה או משפט.</div>';return}

  const cached=getCachedAnalysis(text);
  if(cached?.data){
    displayAI(cached.data,{});
    $("aiResult").insertAdjacentHTML("afterbegin",
      '<div class="cache-note">✓ התוצאה כבר נותחה בעבר ולכן הוצגה מיד.</div>');
    return;
  }

  $("analyzeButton").disabled=true;
  activeAnalysisController=new AbortController();
  const started=performance.now();
  const timeout=setTimeout(()=>activeAnalysisController.abort(),47000);
  stopProgressAnimation=startProgress(text,activeAnalysisController);

  try{
    const r=await fetch("/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text}),
      signal:activeAnalysisController.signal
    });
    const data=await readApiResponse(r);
    if(!r.ok)throw new Error(data.error||data.detail||`אירעה שגיאה (${r.status}).`);

    const elapsedSeconds=((performance.now()-started)/1000).toFixed(1);
    stopProgressAnimation?.();
    stopProgressAnimation=null;
    displayAI(data,{elapsedSeconds});
    saveCachedAnalysis(text,data);

    const h=read(AI_HISTORY_KEY,[]).filter(x=>x.correctedJapanese!==data.correctedJapanese);
    write(AI_HISTORY_KEY,[data,...h].slice(0,30));
  }catch(err){
    stopProgressAnimation?.();
    stopProgressAnimation=null;
    const message=err.name==="AbortError"
      ?"הניתוח בוטל או עבר את מגבלת הזמן. אפשר לנסות שוב עם טקסט קצר יותר."
      :err.message;
    $("aiResult").innerHTML=`<div class="error">${esc(message)}</div>`;
  }finally{
    clearTimeout(timeout);
    activeAnalysisController=null;
    $("analyzeButton").disabled=false;
  }
}
async function loadApiStatus(){
  try{
    const r=await fetch("/api/status");
    const data=await readApiResponse(r);
    $("apiStatus").textContent=data.keyConfigured?`מפתח נטען · ${data.model}`:"מפתח לא נטען";
    $("apiStatus").className=data.keyConfigured?"badge":"badge custom";
  }catch{
    $("apiStatus").textContent="לא ניתן לבדוק את השרת";
    $("apiStatus").className="badge custom";
  }
}
async function checkApi(){
  $("checkApiButton").disabled=true;
  $("apiStatus").textContent="בודק חיבור…";
  try{
    const r=await fetch("/api/check",{method:"POST"});
    const data=await readApiResponse(r);
    if(!r.ok)throw new Error(data.error||"בדיקת החיבור נכשלה.");
    $("apiStatus").textContent=`החיבור תקין · ${data.model}`;
    $("apiStatus").className="badge";
  }catch(err){
    $("apiStatus").textContent=err.message;
    $("apiStatus").className="badge custom";
  }finally{$("checkApiButton").disabled=false}
}
$("analyzeButton").onclick=analyze;
$("checkApiButton").onclick=checkApi;
document.querySelectorAll("[data-ai-example]").forEach(b=>b.onclick=()=>{$("aiInput").value=b.dataset.aiExample;$("aiInput").focus()});
renderSaved();
loadApiStatus();
