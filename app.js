// BNCC Avançado v2.3 — app.js (ES Module)
/* global html2canvas */
const qs = (s, el=document)=>el.querySelector(s);
const qsa = (s, el=document)=>[...el.querySelectorAll(s)];
const $ = {
  on: (el, ev, fn)=>el.addEventListener(ev, fn),
  el: (tag, attrs={})=>Object.assign(document.createElement(tag), attrs)
};

// ---------- Estado ----------
let appState = {
  selectedSkills: [],
  teaModeActive: false,
  userProfile: { teacher: "Professora", school: "" },
  stats: { skills: 0, items: 0 },
  workspace: { objectives: [], activities: [], games: [], assessments: [] },
  myActivities: [],
  chatbot: {
    messages: [],
    answers: {},
    step: 0,
    active: false,
    complete: false
  }
};

function saveState(){
  try{
    localStorage.setItem("bncc-advanced-preferences", JSON.stringify(appState));
  }catch(e){ console.warn("saveState", e); }
}
function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem("bncc-advanced-preferences"));
    if(saved){
      // assegura estrutura mínima
      appState = Object.assign({}, appState, saved);
      for(const k of ["objectives","activities","games","assessments"]){
        appState.workspace[k] ||= [];
      }
      appState.myActivities ||= [];
      appState.chatbot ||= { messages: [], answers: {}, step: 0, active: false, complete: false };
    }
  }catch(e){ console.warn("loadState", e); }
}
loadState();

// ---------- Dataset ----------
let BNCC = null;
const FALLBACK = {
  "2º ano": {
    "Língua Portuguesa": [
      {"codigo":"EF02LP01","tema":"Leitura","descricao":"Identificar o assunto de textos informativos curtos.","tags":["leitura","compreensão"]},
      {"codigo":"EF02LP02","tema":"Produção de texto","descricao":"Produzir bilhetes simples com finalidade comunicativa.","tags":["escrita","gêneros"]},
      {"codigo":"EF02LP03","tema":"Oralidade","descricao":"Relatar experiências pessoais com sequência temporal.","tags":["oralidade"]}
    ],
    "Matemática": [
      {"codigo":"EF02MA01","tema":"Números","descricao":"Ler, escrever e ordenar números naturais até 1000.","tags":["números","ordenação"]},
      {"codigo":"EF02MA05","tema":"Operações","descricao":"Resolver e criar problemas de adição e subtração.","tags":["problemas","adição","subtração"]},
      {"codigo":"EF02MA12","tema":"Geometria","descricao":"Reconhecer figuras geométricas planas no cotidiano.","tags":["geometria"]}
    ]
  },
  "5º ano": {
    "Língua Portuguesa": [
      {"codigo":"EF05LP01","tema":"Leitura","descricao":"Inferir informações implícitas em textos narrativos.","tags":["inferência","leitura"]},
      {"codigo":"EF05LP06","tema":"Coesão","descricao":"Empregar conectivos para organizar ideias em textos.","tags":["coesão","escrita"]},
      {"codigo":"EF05LP20","tema":"Gramática","descricao":"Reconhecer classes de palavras em textos diversos.","tags":["gramática"]}
    ],
    "Matemática": [
      {"codigo":"EF05MA03","tema":"Multiplicação","descricao":"Resolver problemas com multiplicação e divisão.","tags":["operações"]},
      {"codigo":"EF05MA07","tema":"Frações","descricao":"Representar frações e compará-las em diferentes contextos.","tags":["frações"]},
      {"codigo":"EF05MA24","tema":"Dados","descricao":"Ler e interpretar tabelas e gráficos de colunas.","tags":["dados","gráficos"]}
    ]
  }
};

async function loadBNCC(){
  try{
    const res = await fetch("bncc.json",{cache:"no-cache"});
    if(!res.ok) throw new Error("fetch bncc.json");
    BNCC = await res.json();
  }catch(e){
    console.warn("Usando dataset interno (fallback)", e);
    BNCC = FALLBACK;
  }
}

// ---------- Util ----------
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ---------- Biblioteca ----------
function getFilteredSkills(){
  const ano = qs("#anoSel").value;
  const comp = qs("#compSel").value;
  const term = qs("#busca").value.trim().toLowerCase();
  const arr = (BNCC?.[ano]?.[comp] || []).filter(it => {
    if(!term) return true;
    const hay = (it.codigo+" "+it.tema+" "+it.descricao+" "+(it.tags||[]).join(" ")).toLowerCase();
    return hay.includes(term);
  });
  return arr;
}

function makeSkillCard(skill){
  const card = $.el("div", {className:"skill", draggable:true});
  card.dataset.payload = JSON.stringify({ type:"skill", skill });
  card.addEventListener("dragstart", e=>{
    e.dataTransfer?.setData("text/plain", card.dataset.payload);
  });

  const h = $.el("div");
  h.innerHTML = `<strong>${esc(skill.codigo)}</strong> — ${esc(skill.tema)}`;
  const p = $.el("p"); p.textContent = skill.descricao;
  const meta = $.el("div", {className:"meta"});
  (skill.tags||[]).forEach(t => {
    const chip = $.el("span",{className:"chip"}); chip.textContent = t;
    meta.appendChild(chip);
  });

  const actions = $.el("div", {style:"display:flex;gap:6px;flex-wrap:wrap"});
  [["🎯 Objetivo","objectives"],["🛠️ Atividade","activities"],["🎲 Jogo","games"],["📊 Avaliação","assessments"]]
    .forEach(([label,sect])=>{
      const b = $.el("button",{className:"btn btn--sm"});
      b.textContent = `+ ${label}`;
      b.addEventListener("click",()=> addSkillToSection(skill, sect));
      actions.appendChild(b);
    });

  card.append(h,p,meta,actions);
  return card;
}

function renderLibrary(){
  const list = qs("#libraryList");
  list.setAttribute("aria-busy","true");
  list.innerHTML = "";
  const arr = getFilteredSkills();
  if(arr.length===0){
    list.innerHTML = `<div class="card">Nenhuma habilidade encontrada. Tente outro termo.</div>`;
  }else{
    arr.forEach(skill=> list.appendChild(makeSkillCard(skill)));
  }
  list.setAttribute("aria-busy","false");
}

// ---------- Workspace ----------
function addSkillToSection(skill, section){
  const item = {
    id: crypto.randomUUID(),
    codigo: skill.codigo,
    titulo: `${skill.codigo} — ${skill.tema}`,
    descricao: skill.descricao,
    tea: appState.teaModeActive ? makeTeaTip(skill) : null
  };
  appState.workspace[section].push(item);
  syncWorkspaceDOM();
  updateStats();
  saveState();
}

function removeItem(section, id){
  appState.workspace[section] = appState.workspace[section].filter(x=>x.id!==id);
  syncWorkspaceDOM();
  updateStats();
  saveState();
}

function makeTeaTip(skill){
  // Regra simples apenas como exemplo
  const map = {
    "Leitura":"Use organizadores visuais, leitura guiada e pictogramas.",
    "Operações":"Materiais concretos e sequenciação passo a passo.",
    "Frações":"Modelos visuais e manipulação com círculos fracionários."
  };
  return map[skill.tema] || "Ajustar linguagem, passos curtos, reforço visual e pausa ativa.";
}

function zoneNode(section){ return qs(`#${section}-zone .zone-list`); }

function droppedItemNode(section, item){
  const node = $.el("div",{className:"dropped-item", draggable:false});
  const title = $.el("div"); title.innerHTML = `<strong>${esc(item.titulo)}</strong>${item.tea?` <span class="badge">TEA</span>`:""}`;
  const desc = $.el("div"); desc.textContent = item.descricao;
  const left = $.el("div"); left.append(title, desc);
  const actions = $.el("div",{className:"actions"});
  const del = $.el("button",{className:"btn btn--danger btn--sm", title:"Remover"}); del.textContent="Remover";
  del.addEventListener("click",()=> removeItem(section, item.id));
  actions.appendChild(del);
  node.append(left, actions);
  return node;
}


function enableDnD(){
  // Zonas aceitam drop de cards da biblioteca
  qsa(".dropzone").forEach(zone=>{
    zone.addEventListener("dragover", e=>{
      if(e.dataTransfer) e.preventDefault();
    });
    zone.addEventListener("drop", e=>{
      e.preventDefault();
      try{
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if(data?.type==="skill"){
          const section = zone.dataset.section;
          addSkillToSection(data.skill, section);
        }
      }catch(_){}
    });
  });
}

function enableSortable(){
  ["objectives","activities","games","assessments"].forEach(section=>{
    const list = zoneNode(section);
    if(!list) return;
    Sortable.create(list, {
      animation: 150,
      onEnd: ()=>{
        // Reconciliar ordem pelo DOM
        const newArr = [];
        list.querySelectorAll(".dropped-item").forEach(node=>{
          // reconstruir a partir do texto; guardamos id em dataset para ser robusto
          // vamos guardar dataset-id ao criar
        });
        // Alternativa: reconstruir diretamente da posição anterior
        // Mais simples: nada a fazer, pois Sortable só reordena DOM; re-sincronizar lendo appState e re-render é caro.
        // Implementação robusta: inserir data-id e reconstruir:
        const ids = [...list.querySelectorAll(".dropped-item")].map(n=>n.dataset.id);
        const byId = Object.fromEntries(appState.workspace[section].map(i=>[i.id,i]));
        ids.forEach(id => byId[id] && newArr.push(byId[id]));
        appState.workspace[section] = newArr;
        saveState();
      }
    });
  });
}

function syncWorkspaceDOM(){
  ["objectives","activities","games","assessments"].forEach(section=>{
    const list = zoneNode(section);
    list.innerHTML = "";
    appState.workspace[section].forEach(it=>{
      const node = droppedItemNode(section, it);
      node.dataset.id = it.id;
      list.appendChild(node);
    });
  });
}

// ---------- Minhas Atividades ----------
function renderMyActivities(){
  const wrap = qs("#myActivitiesList");
  wrap.innerHTML = "";
  if(appState.myActivities.length===0){
    wrap.innerHTML = `<div class="card">Nenhuma atividade criada.</div>`;
    return;
  }
  appState.myActivities.forEach((a, idx)=>{
    const card = $.el("div",{className:"skill"});
    const h = $.el("div"); h.innerHTML = `<strong>${esc(a.title)}</strong> ${a.tags?`<span class="badge">${esc(a.tags)}</span>`:""}`;
    const p = $.el("p"); p.textContent = a.description || "";
    const actions = $.el("div", {style:"display:flex;gap:6px"});
    const del = $.el("button",{className:"btn btn--danger btn--sm"}); del.textContent="Excluir";
    del.addEventListener("click",()=>{
      appState.myActivities.splice(idx,1);
      renderMyActivities(); saveState();
    });
    const add = $.el("button",{className:"btn btn--sm"}); add.textContent="+ Enviar ao Workspace";
    add.addEventListener("click",()=>{
      const skill = { codigo:"ATV", tema:a.title, descricao:a.description };
      addSkillToSection(skill, "activities");
    });
    actions.append(del, add);
    card.append(h,p,actions);
    wrap.appendChild(card);
  });
}

// ---------- Chatbot ----------
const STORY_PROMPT = [
  { key: "hero", q: "Olá! Vamos criar uma história juntos. Qual é o nome do nosso herói ou heroína?" },
  { key: "place", q: "Legal! Onde a aventura de {hero} acontece?" },
  { key: "friend", q: "Todo herói precisa de um amigo. Quem acompanha {hero} nesta jornada?" },
  { key: "challenge", q: "Qual é o maior desafio que {hero} e {friend} encontram?" },
  { key: "solution", q: "E como eles, com muita criatividade, superam o desafio '{challenge}'?" },
];

function renderChatMessages() {
  const container = qs("#chatMessages");
  container.innerHTML = "";
  appState.chatbot.messages.forEach(msg => {
    const msgEl = $.el("div", { className: `chat-message ${msg.sender}` });
    msgEl.textContent = msg.text;
    container.appendChild(msgEl);
  });
  container.scrollTop = container.scrollHeight;
}

function addChatMessage(sender, text) {
  appState.chatbot.messages.push({ sender, text });
  renderChatMessages();
}

function generateFinalStory() {
  const { answers } = appState.chatbot;
  return `Era uma vez, um(a) herói(na) chamado(a) ${answers.hero}, que vivia em ${answers.place}. Um dia, ${answers.hero} e seu fiel amigo ${answers.friend} se depararam com um grande desafio: ${answers.challenge}. Com coragem e inteligência, eles encontraram uma solução: ${answers.solution}. E assim, eles salvaram o dia!`;
}

function askNextQuestion() {
  const { step, answers } = appState.chatbot;
  if (step < STORY_PROMPT.length) {
    const nextQ = STORY_PROMPT[step];
    let questionText = nextQ.q;
    // Replace placeholders
    for(const key in answers) {
      questionText = questionText.replace(`{${key}}`, answers[key]);
    }
    addChatMessage("bot", questionText);
    appState.chatbot.step++;
  } else {
    // Story is complete
    appState.chatbot.complete = true;
    const finalStory = generateFinalStory();
    addChatMessage("bot", "Ótimo! Aqui está a sua história:");
    addChatMessage("bot", finalStory);

    const actions = $.el("div", { style: "display: flex; gap: 10px; margin-top: 10px;" });
    const copyBtn = $.el("button", { className: "btn btn--sm" });
    copyBtn.textContent = "Copiar História";
    $.on(copyBtn, "click", () => {
      navigator.clipboard.writeText(finalStory)
        .then(() => alert("História copiada!"))
        .catch(err => console.warn("Falha ao copiar", err));
    });

    const resetBtn = $.el("button", { className: "btn btn--sm btn--ghost" });
    resetBtn.textContent = "Começar de Novo";
    $.on(resetBtn, "click", startChat);

    actions.append(copyBtn, resetBtn);
    qs("#chatMessages").appendChild(actions);
  }
  saveState();
}

function startChat() {
  appState.chatbot = {
    messages: [],
    answers: {},
    step: 0,
    active: true,
    complete: false
  };
  askNextQuestion();
}

function handleChatMessage() {
  const input = qs("#chatInput");
  const text = input.value.trim();
  if (!text || appState.chatbot.complete) return;

  addChatMessage("user", text);

  const currentStep = appState.chatbot.step - 1;
  const currentQ = STORY_PROMPT[currentStep];
  appState.chatbot.answers[currentQ.key] = text;

  input.value = "";
  setTimeout(askNextQuestion, 500);
}

// ---------- Exportações ----------
async function exportWorkspaceToPDF(){
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF){ alert("jsPDF não carregou. Verifique a conexão."); return; }
  const node = qs(".canvas");
  window.scrollTo(0,0);
  const canvas = await html2canvas(node, {scale:2, useCORS:true});
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p","mm","a4");
  const pageW = 210, pageH = 297;
  const margin = 8;
  const imgW = pageW - margin*2;
  const imgH = canvas.height * imgW / canvas.width;
  let y = margin;
  if(imgH <= pageH - margin*2){
    pdf.addImage(img, "PNG", margin, y, imgW, imgH);
  }else{
    // slice vertical em páginas
    let sY = 0;
    const pagePxH = (pageH - margin*2) * canvas.width / imgW;
    while(sY < canvas.height){
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.min(pagePxH, canvas.height - sY);
      const ctx = slice.getContext("2d");
      ctx.drawImage(canvas, 0, sY, canvas.width, slice.height, 0, 0, slice.width, slice.height);
      const part = slice.toDataURL("image/png");
      pdf.addImage(part, "PNG", margin, margin, imgW, (slice.height * imgW)/slice.width);
      sY += pagePxH;
      if(sY < canvas.height) pdf.addPage();
    }
  }
  pdf.save(`plano-bncc-${Date.now()}.pdf`);
}

function exportStateJSON(){
  const data = JSON.stringify(appState, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = $.el("a",{href:url, download:`bncc-state-${Date.now()}.json`});
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- UI & Eventos ----------
function selectTab(id){
  ["tab-library","tab-workspace","tab-my", "tab-chatbot"].forEach(sec=>{
    const on = sec===id;
    qs("#"+sec).hidden = !on;
    const btn = qs(`#${sec}-btn`);
    if(btn){
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("active", on);
    }
  });
}

function updateStats(){
  appState.stats.skills = appState.selectedSkills?.length || 0;
  appState.stats.items = ["objectives","activities","games","assessments"]
    .reduce((n,k)=> n + appState.workspace[k].length, 0);
  qs("#statSkills").textContent = appState.stats.skills;
  qs("#statItems").textContent = appState.stats.items;
  qs("#statTea").textContent = appState.teaModeActive ? "ligado" : "desligado";
}

function attachEvents(){
  $.on(qs("#busca"), "input", renderLibrary);
  $.on(qs("#anoSel"), "change", renderLibrary);
  $.on(qs("#compSel"), "change", renderLibrary);

  $.on(qs("#toggleTeaBtn"), "click", ()=>{
    appState.teaModeActive = !appState.teaModeActive;
    qs("#toggleTeaBtn").setAttribute("aria-pressed", String(appState.teaModeActive));
    updateStats(); saveState();
  });

  // Tabs
  $.on(qs("#tab-library-btn"), "click", ()=> selectTab("tab-library"));
  $.on(qs("#tab-workspace-btn"), "click", ()=> selectTab("tab-workspace"));
  $.on(qs("#tab-my-btn"), "click", ()=> selectTab("tab-my"));
  $.on(qs("#tab-chatbot-btn"), "click", ()=> {
    selectTab("tab-chatbot");
    if(!appState.chatbot.active) startChat();
  });

  // Export modal
  const modal = qs("#exportModal");
  $.on(qs("#openExport"), "click", ()=> modal.setAttribute("open",""));
  $.on(qs("#closeExport"), "click", ()=> modal.removeAttribute("open"));
  qsa("[data-export]").forEach(btn=>{
    $.on(btn, "click", async ()=>{
      const type = btn.dataset.export;
      if(type==="pdf") await exportWorkspaceToPDF();
      if(type==="json") exportStateJSON();
    });
  });
  // Quick export buttons
  $.on(qs("#exportJSON"), "click", exportStateJSON);
  $.on(qs("#importJSON"), "change", e=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const obj = JSON.parse(reader.result);
        appState = Object.assign({}, appState, obj);
        syncWorkspaceDOM(); renderMyActivities(); updateStats(); saveState();
        alert("Estado importado com sucesso.");
      }catch(err){ alert("JSON inválido."); }
    };
    reader.readAsText(file);
  });

  // Chatbot events
  $.on(qs("#chatSendBtn"), "click", handleChatMessage);
  $.on(qs("#chatInput"), "keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleChatMessage();
    }
  });

  // Add custom activity
  $.on(qs("#addCustom"), "click", ()=>{
    const title = qs("#customTitle").value.trim();
    const tags = qs("#customTags").value.trim();
    const description = qs("#customDescription").value.trim();
    if(!title){ alert("Dê um título."); return; }
    appState.myActivities.push({ title, tags, description });
    qs("#customTitle").value = ""; qs("#customTags").value = ""; qs("#customDescription").value = "";
    renderMyActivities(); saveState();
  });

  // Shortcuts
  document.addEventListener("keydown", e=>{
    if(e.key==="/"){ e.preventDefault(); qs("#busca").focus(); }
    if(e.key==="g"){ selectTab("tab-workspace"); }
  });

  // Preferências simples
  ["prefTheme","prefClass","prefTime"].forEach(id=>{
    const el = qs("#"+id);
    el.value = appState.userProfile[id] || "";
    $.on(el, "input", ()=>{
      appState.userProfile[id] = el.value;
      saveState();
    });
  });
}

function handleRouting(){
  const hash = window.location.hash.substring(1);
  if (['tab-library', 'tab-workspace', 'tab-my'].includes(hash)) {
    selectTab(hash);
  }
}

// ---------- Init ----------
(async function init(){
  await loadBNCC();
  attachEvents();
  enableDnD();
  renderLibrary();
  syncWorkspaceDOM();
  enableSortable();
  renderMyActivities();
  updateStats();

  window.addEventListener('hashchange', handleRouting, false);
  handleRouting();

  // Render initial chat messages if any
  renderChatMessages();
})();
