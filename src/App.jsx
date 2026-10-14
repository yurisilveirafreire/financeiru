import { useState, useEffect } from "react";

// ============================================================
// FIREBASE CONFIG
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD4GDfgBmYhr37B6gDeN1jv4lGb5EGvvxc",
  authDomain: "financeiru.firebaseapp.com",
  projectId: "financeiru",
  storageBucket: "financeiru.firebasestorage.app",
  messagingSenderId: "868386871849",
  appId: "1:868386871849:web:f8baa786b8f29456feda38",
};

// ============================================================
// PLANOS
// ============================================================
const PLANS = {
  explorador: { name: "Explorador", limit: 10, price: 0 },
  pro_mensal: { name: "Pro Mensal", limit: Infinity, price: 19.90 },
  pro_anual:  { name: "Pro Anual",  limit: Infinity, price: 9.90 },
  influencer: { name: "Influencer", limit: Infinity, price: 0 },
  admin:      { name: "Admin Pro",  limit: Infinity, price: 0 },
};

// E-mails com acesso Pro vitalício e gratuito (super admin)
const ADMIN_EMAILS = ["yurisilveirafreire@hotmail.com"];
const isAdminEmail = (email) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());
// Valor mensal (R$) de cada plano pago — base do cálculo de comissão de afiliados
const PLAN_MONTHLY = { pro_mensal: 19.90, pro_anual: 9.90 };

// ============================================================
// FIREBASE
// ============================================================
let _fb = null;
async function getFirebase() {
  if (_fb) return _fb;
  const [appMod, fsMod, authMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  _fb = { ...fsMod, ...authMod, db: fsMod.getFirestore(app), auth: authMod.getAuth(app) };
  return _fb;
}

// ============================================================
// CATEGORIAS PADRÃO
// ============================================================
const DEFAULT_CATEGORIES = [
  { id: "moradia",     label: "Moradia",         icon: "🏠", color: "#3B7BFF", type: "expense" },
  { id: "alimentacao", label: "Alimentação",      icon: "🛒", color: "#E8930A", type: "expense" },
  { id: "transporte",  label: "Transporte",       icon: "🚗", color: "#3b82f6", type: "expense" },
  { id: "saude",       label: "Saúde",            icon: "💊", color: "#10b981", type: "expense" },
  { id: "lazer",       label: "Lazer",            icon: "🎉", color: "#FF3D7F", type: "expense" },
  { id: "educacao",    label: "Educação",         icon: "📚", color: "#3B7BFF", type: "expense" },
  { id: "vestuario",   label: "Vestuário",        icon: "👗", color: "#E8930A", type: "expense" },
  { id: "pessoal",     label: "Gastos Pessoais",  icon: "👤", color: "#14b8a6", type: "expense" },
  { id: "dividas",     label: "Dívidas/Parcelas", icon: "💳", color: "#E23D5B", type: "expense" },
  { id: "salario",     label: "Salário",          icon: "💼", color: "#00B86B", type: "income"  },
  { id: "freela",      label: "Freelance/Extra",  icon: "💡", color: "#3B7BFF", type: "income"  },
  { id: "outros",      label: "Outros",           icon: "📦", color: "#8A91A3", type: "both"    },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const todayStr = () => { const d=new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
// Máscara de dinheiro: recebe só os dígitos (centavos) e mostra "1.000,00"
const maskMoney = (digits) => (Number(String(digits).replace(/\D/g,"")||0)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
// Máscara de data: 20042026 -> 20/04/2026 (progressivo)
const maskDate = (raw) => { const d=String(raw).replace(/\D/g,"").slice(0,8); let o=d.slice(0,2); if(d.length>2)o+="/"+d.slice(2,4); if(d.length>4)o+="/"+d.slice(4,8); return o; };
const monthKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
// Nome legível de categoria: remove sufixo técnico "_1783870137705" e deixa bonito
const prettyCat = (cid) => String(cid||"").replace(/[_-]?\d{9,}$/,"").replace(/[_-]+/g," ").trim().replace(/^\w/, c=>c.toUpperCase()) || "Outros";
// Resolve categoria: acha na lista ou cria um fallback limpo (nome sem números)
const catOf = (categories, id, icon="📦", color="#8A91A3") => categories.find(c=>c.id===id) || { id, label:prettyCat(id), icon, color };

// ============================================================
// DEMO DATA
// ============================================================
let demoIncomes = [
  { id:"i1", userId:"u1", userName:"Você",   description:"Salário", amount:5500, category:"salario", date:"01/07/2026", month:"2026-07", createdAt:1 },
  { id:"i2", userId:"u2", userName:"Esposa", description:"Salário", amount:4200, category:"salario", date:"01/07/2026", month:"2026-07", createdAt:2 },
];
let demoExpenses = [
  { id:"e1", userId:"u1", userName:"Você",   description:"Aluguel",  amount:1800, category:"moradia",     date:"05/07/2026", month:"2026-07", createdAt:4 },
  { id:"e2", userId:"u2", userName:"Esposa", description:"Mercado",  amount:650,  category:"alimentacao", date:"10/07/2026", month:"2026-07", createdAt:5 },
  { id:"e3", userId:"u1", userName:"Você",   description:"Gasolina", amount:280,  category:"transporte",  date:"12/07/2026", month:"2026-07", createdAt:6 },
  { id:"e4", userId:"u2", userName:"Esposa", description:"Farmácia", amount:120,  category:"saude",       date:"15/07/2026", month:"2026-07", createdAt:7 },
  { id:"e5", userId:"u1", userName:"Você",   description:"Netflix",  amount:75,   category:"lazer",       date:"18/07/2026", month:"2026-07", createdAt:8 },
];
let demoCategories = [...DEFAULT_CATEGORIES];
let demoGoals = { "2026-07": 2000 };

// ============================================================
// APP ROOT
// ============================================================
// ============================================================
// INSTALL PROMPT (PWA) — ensina a instalar na tela inicial
// ============================================================
function InstallPrompt(){
  const [show,setShow]     = useState(false);
  const [mode,setMode]     = useState("");   // ios-safari | ios-other | android
  const [expand,setExpand] = useState(false);
  const bip = useState(function(){ return { e:null }; })[0];

  useEffect(function(){
    try{
      const nav = window.navigator;
      const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true;
      if(standalone) return;
      const d = Number(localStorage.getItem("igastei_install_dismiss")||0);
      if(d && (Date.now()-d) < 7*24*60*60*1000) return;
      const ua = nav.userAgent || "";
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      if(isIOS){
        const isSafari = !/crios|fxios|edgios|opios/i.test(ua);
        setMode(isSafari ? "ios-safari" : "ios-other");
        setShow(true);
      }
    }catch(e){}
  },[]);

  useEffect(function(){
    function onBIP(e){ e.preventDefault(); bip.e=e; setMode("android"); setShow(true); }
    window.addEventListener("beforeinstallprompt", onBIP);
    return function(){ window.removeEventListener("beforeinstallprompt", onBIP); };
  },[]);

  function dismiss(){ try{ localStorage.setItem("igastei_install_dismiss", String(Date.now())); }catch(e){} setShow(false); }
  async function installAndroid(){ const e=bip.e; if(!e) return; e.prompt(); try{ await e.userChoice; }catch(_){} bip.e=null; dismiss(); }

  if(!show) return null;

  const wrap    = { position:"fixed", left:12, right:12, bottom:14, zIndex:9999, display:"flex", justifyContent:"center", pointerEvents:"none" };
  const card    = { pointerEvents:"auto", width:"100%", maxWidth:440, background:"#FFFFFF", border:"1px solid #E7E9F0", borderRadius:18, padding:"14px 16px", boxShadow:"0 12px 40px rgba(0,0,0,.45)", color:"#fff", fontFamily:"Inter, sans-serif" };
  const row     = { display:"flex", alignItems:"center", gap:12 };
  const iconBox = { width:44, height:44, borderRadius:12, background:"#F1F3F7", border:"1px solid #E7E9F0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontWeight:900, color:"#00B86B", fontSize:19 };
  const btn     = { background:"#00B86B", color:"#04120a", border:"none", borderRadius:10, padding:"9px 14px", fontWeight:800, fontSize:14, cursor:"pointer", whiteSpace:"nowrap" };
  const xbtn    = { background:"transparent", color:"#8A91A3", border:"none", fontSize:22, cursor:"pointer", lineHeight:1, padding:"0 4px" };
  const ShareIcon = function(){ return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{verticalAlign:"-3px"}}>
      <path d="M12 3v12" stroke="#00B86B" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M8 7l4-4 4 4" stroke="#00B86B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" stroke="#00B86B" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ); };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={row}>
          <div style={iconBox}>iG</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:900, fontSize:15}}>{"\U0001F4F2"} Instale o iGastei</div>
            <div style={{fontSize:12.5, color:"#8A91A3", marginTop:1}}>
              {mode==="android"    && "Acesso rápido na sua tela inicial."}
              {mode==="ios-safari" && "Adicione à tela inicial pra abrir como app."}
              {mode==="ios-other"  && "Abra no Safari pra instalar como app."}
            </div>
          </div>
          {mode==="android"
            ? <button style={btn} onClick={installAndroid}>Instalar ⚡</button>
            : mode==="ios-safari"
              ? <button style={btn} onClick={function(){ setExpand(function(v){ return !v; }); }}>Como?</button>
              : null}
          <button style={xbtn} onClick={dismiss} aria-label="Fechar">×</button>
        </div>

        {mode==="ios-safari" && expand && (
          <div style={{marginTop:12, paddingTop:12, borderTop:"1px solid #E7E9F0", fontSize:13.5, lineHeight:1.8, color:"#555c6b"}}>
            <div>1. Toque em <ShareIcon/> <b>Compartilhar</b> (na barra de baixo).</div>
            <div>2. Role e toque em <b>{"“"}Adicionar {"à"} Tela de In{"í"}cio{"”"}</b>.</div>
            <div>3. Toque em <b>Adicionar</b>. Pronto! 💚</div>
          </div>
        )}

        {mode==="ios-other" && (
          <div style={{marginTop:10, fontSize:12.5, color:"#555c6b"}}>
            Copie o link e abra no <b>Safari</b> {"—"} depois {"é"} s{"ó"} {"“"}Adicionar {"à"} Tela de In{"í"}cio{"”"}.
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen]     = useState("login");
  const [user, setUser]         = useState(null);
  const [accountData, setAccountData] = useState(null); // dados da conta (plano, membros)
  const [demo, setDemo]         = useState(false);
  const [tab, setTab]           = useState("dashboard");
  const [month, setMonth]       = useState(monthKey);
  const [incomes, setIncomes]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [goal, setGoal]         = useState(0);
  const [fb, setFb]             = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [histData, setHistData] = useState([]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [refCode, setRefCode]   = useState("");
  const isBigMouse = () => typeof window!=="undefined" && window.innerWidth>=1000 && !(window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
  const [isDesktop, setIsDesktop] = useState(isBigMouse());

  useEffect(()=>{
    const onResize=()=>setIsDesktop(isBigMouse());
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  // Detecta ?upgrade=success e ?ref=CODIGO na URL
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const up = params.get('upgrade');
    if(up && up.indexOf('success')===0){ setShowSuccess(true); }
    const ref = params.get('ref');
    if(ref){ setRefCode(ref.trim().toUpperCase()); }
    if(up || ref){ window.history.replaceState({}, '', '/'); }
  },[]);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3200); };

  useEffect(() => {
    getFirebase().then(f => {
      setFb(f);
      f.onAuthStateChanged(f.auth, async u => {
        if (u) {
          setUser(u);
          const email = u.email;
          let data = null;
          // 1) Fui convidado como membro de OUTRA conta? Então uso a conta compartilhada.
          try {
            const snap = await f.getDocs(f.query(f.collection(f.db,"accounts"), f.where("members","array-contains", email)));
            const guest = snap.docs.find(d => d.data().ownerId && d.data().ownerId !== u.uid);
            const own   = snap.docs.find(d => d.data().ownerId === u.uid);
            if (guest) data = guest.data();
            else if (own) data = own.data();
          } catch(e) {}
          // 2) Senão, uso/crio a minha própria conta
          if (!data) {
            const ref = f.doc(f.db, "accounts", u.uid);
            const ex = await f.getDoc(ref);
            if (ex.exists()) data = ex.data();
            else {
              data = {
                ownerId: u.uid, ownerEmail: email, plan: "explorador",
                members: [email], createdAt: Date.now(), city: "", state: "",
                displayName: u.displayName || email.split("@")[0],
              };
              await f.setDoc(ref, data);
            }
          }
          // Super admin: sempre Pro grátis (só na conta própria do admin)
          if (isAdminEmail(email) && data.ownerId === u.uid && data.plan !== "admin") {
            data = { ...data, plan: "admin", planStatus: "active" };
            await f.setDoc(f.doc(f.db, "accounts", u.uid), { plan: "admin", planStatus: "active" }, { merge: true });
          }
          setAccountData(data);
          setScreen("app");
        } else {
          setScreen("login");
        }
      });
    }).catch(()=>{});
  }, []);

  // Resolve accountId: no Firebase, usa o ownerId da conta
  // Membros da mesma casa compartilham o mesmo accountId
  const getAccountId = async (userEmail) => {
    if (!fb) return null;
    // Verifica se o user é membro de alguma conta existente
    const { collection, query, where, getDocs, db } = fb;
    const q = query(collection(db, "accounts"), where("members", "array-contains", userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    return null;
  };

  useEffect(() => {
    if (demo) {
      setIncomes(demoIncomes.filter(i=>i.month===month));
      setExpenses(demoExpenses.filter(e=>e.month===month));
      setCategories(demoCategories);
      setGoal(demoGoals[month]||0);
      setAccountData({ plan: "explorador", members: ["voce@demo.com"], displayName: "Demo" });
      return;
    }
    if (!fb || !user || !accountData) return;

    // Usa o accountId (ownerId da conta compartilhada)
    const accountId = accountData.ownerId || user.uid;
    const { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, db } = fb;

    // Dados são filtrados por accountId para que membros vejam o mesmo
    const u1 = onSnapshot(
      query(collection(db,"incomes"), where("month","==",month)),
      s => setIncomes(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.accountId===accountId))
    );
    const u2 = onSnapshot(
      query(collection(db,"expenses"), where("month","==",month)),
      s => setExpenses(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.accountId===accountId))
    );

    // 🔁 Preenche as contas fixas (recorrentes) neste mês se ainda não existirem.
    // Funciona pra qualquer recorrente (inclusive as criadas antes dessa versão).
    const fillRecorrentes = async (col) => {
      try {
        const snap = await getDocs(query(collection(db,col), where("accountId","==",accountId), where("recorrente","==",true)));
        const all = snap.docs.map(d=>({id:d.id,...d.data()}));
        const groups = {};
        for (const s of all){ const k = s.recId || s.id; if(!groups[k] || (s.month||"") < groups[k].month) groups[k] = { ...s, month: s.month||month }; }
        for (const k of Object.keys(groups)){
          const seed = groups[k];
          if (!seed.month || seed.month > month) continue;                 // ainda não começou
          if (all.some(s => (s.recId||s.id)===k && s.month===month)) continue; // já tem neste mês
          const recId = seed.recId || k;
          const dd = (String(seed.date||"").split("/")[0]) || "01";
          const [yy,mm] = month.split("-");
          await setDoc(doc(db,col,`${recId}_${month}`), {
            accountId, userId: seed.userId||user.uid, userName: seed.userName||"",
            description: seed.description||"", amount: Number(seed.amount)||0, category: seed.category||"outros",
            status: "previsto", recorrente: true, recId, month, date: `${dd}/${mm}/${yy}`, createdAt: Date.now(),
          });
        }
      } catch(e){}
    };
    fillRecorrentes("incomes"); fillRecorrentes("expenses");
    const u3 = onSnapshot(
      query(collection(db,"categories"), where("accountId","==",accountId)),
      s => {
        const custom = s.docs.map(d=>({ ...d.data(), id: d.data().id || d.id }));
        // Sempre mantém as categorias padrão + as personalizadas (sem duplicar)
        const merged = [...DEFAULT_CATEGORIES.filter(dc=>!custom.some(c=>c.id===dc.id)), ...custom];
        setCategories(merged);
      }
    );
    getDoc(doc(db,"goals",`${accountId}_${month}`)).then(d=>setGoal(d.exists()?d.data().amount:0));
    return ()=>{u1();u2();u3();};
  }, [fb, user, month, demo, accountData]);

  // Busca histórico últimos 6 meses
  useEffect(() => {
    if (demo) { setHistData([]); return; }
    if (!fb || !user || !accountData) return;
    const accountId = accountData.ownerId || user.uid;
    const { collection, query, where, getDocs, db } = fb;
    const [y,m] = month.split("-").map(Number);
    const months = Array.from({length:6},(_,i)=>{
      const d = new Date(y, m-1-i, 1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    });
    Promise.all(months.map(async mo => {
      const [inc,exp] = await Promise.all([
        getDocs(query(collection(db,"incomes"), where("accountId","==",accountId), where("month","==",mo))),
        getDocs(query(collection(db,"expenses"), where("accountId","==",accountId), where("month","==",mo))),
      ]);
      const totalIn  = inc.docs.reduce((s,d)=>s+Number(d.data().amount),0);
      const totalOut = exp.docs.reduce((s,d)=>s+Number(d.data().amount),0);
      return {month:mo, totalIn, totalOut, balance:totalIn-totalOut};
    })).then(data => setHistData(data.filter(d=>d.totalIn>0||d.totalOut>0).reverse()));
  }, [fb, user, month, demo, accountData]);

  // Verifica limite do plano
  const checkPlanLimit = () => {
    if (demo) return true;
    const plan = PLANS[accountData?.plan || "explorador"];
    if (plan.limit === Infinity) return true;
    const totalLancamentos = incomes.length + expenses.length;
    if (totalLancamentos >= plan.limit) {
      showToast(`🔒 Limite do Modo ${plan.name}: ${plan.limit} lançamentos/mês. Faça upgrade!`, "error");
      return false;
    }
    return true;
  };

  // CRUD
  const addItem = async (col, data) => {
    if (!checkPlanLimit()) return;
    const newAmount = Number(data.amount);
    if (!newAmount || newAmount <= 0) { showToast("⚠️ Valor inválido.","error"); return; }
    const accountId = demo ? "demo" : (accountData?.ownerId || user.uid);
    const base = { ...data, accountId, userId: user?.uid||"demo", userName: user?.displayName||user?.email||"Demo", createdAt: Date.now() };

    // 🔁 Conta fixa (recorrente + previsto): cria com um recId; os outros meses
    // são preenchidos sozinhos quando o usuário abre cada mês (ver fillRecorrentes).
    if (!demo && data.recorrente && data.status==="previsto") {
      const recId = `rec_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      await fb.setDoc(fb.doc(fb.db, col, `${recId}_${month}`), { ...base, month, recId });
      showToast("🔁 Conta fixa criada (repete todo mês) ✅");
      return;
    }

    const item = { ...base, month };
    if (demo) {
      const ni = { ...item, id: Date.now().toString() };
      if (col==="incomes") { demoIncomes.push(ni); setIncomes(p=>[...p,ni]); }
      else { demoExpenses.push(ni); setExpenses(p=>[...p,ni]); }
    } else {
      await fb.addDoc(fb.collection(fb.db,col), item);
    }
    showToast(col==="incomes"?"Entrada adicionada ✅":"Gasto registrado ✅");
  };

  const editItem = async (col, id, data) => {
    if (demo) {
      if (col==="incomes") { demoIncomes=demoIncomes.map(i=>i.id===id?{...i,...data}:i); setIncomes(demoIncomes.filter(i=>i.month===month)); }
      else { demoExpenses=demoExpenses.map(e=>e.id===id?{...e,...data}:e); setExpenses(demoExpenses.filter(e=>e.month===month)); }
    } else { await fb.updateDoc(fb.doc(fb.db,col,id), data); }
    showToast("Atualizado ✅");
  };

  const deleteItem = async (col, id) => {
    if (demo) {
      if (col==="incomes") { demoIncomes=demoIncomes.filter(i=>i.id!==id); setIncomes(p=>p.filter(i=>i.id!==id)); }
      else { demoExpenses=demoExpenses.filter(e=>e.id!==id); setExpenses(p=>p.filter(e=>e.id!==id)); }
    } else { await fb.deleteDoc(fb.doc(fb.db,col,id)); }
    showToast("Removido","info");
  };

  const addCategory = async (cat) => {
    const accountId = demo ? "demo" : (accountData?.ownerId || user.uid);
    const catWithAccount = { ...cat, accountId };
    if (demo) { demoCategories=[...demoCategories,catWithAccount]; setCategories(p=>[...p,catWithAccount]); }
    else await fb.setDoc(fb.doc(fb.db,"categories",`${accountId}_${cat.id}`), catWithAccount);
    showToast("Categoria criada ✅");
  };

  const editCategory = async (cat) => {
    const accountId = demo ? "demo" : (accountData?.ownerId || user.uid);
    const catWithAccount = { ...cat, accountId };
    if (demo) { demoCategories=demoCategories.map(c=>c.id===cat.id?catWithAccount:c); setCategories(demoCategories); }
    else await fb.setDoc(fb.doc(fb.db,"categories",`${accountId}_${cat.id}`), catWithAccount);
    showToast("Categoria atualizada ✅");
  };

  const saveGoal = async (v) => {
    setGoal(v);
    const accountId = demo ? "demo" : (accountData?.ownerId || user.uid);
    if (demo) { demoGoals[month]=v; return; }
    await fb.setDoc(fb.doc(fb.db,"goals",`${accountId}_${month}`),{amount:v});
    showToast("Meta salva ✅");
  };

  const handleLogout = async () => {
    if (demo){ setDemo(false);setUser(null);setAccountData(null);setScreen("login");return; }
    await fb.signOut(fb.auth);
  };

  const totalIn  = incomes.filter(i=>i.status!=="previsto").reduce((s,i)=>s+Number(i.amount),0);
  const totalOut = expenses.filter(e=>e.status!=="previsto").reduce((s,e)=>s+Number(e.amount),0);
  const balance  = totalIn - totalOut;
  const previstoIn  = incomes.filter(i=>i.status==="previsto").reduce((s,i)=>s+Number(i.amount),0);
  const previstoOut = expenses.filter(e=>e.status==="previsto").reduce((s,e)=>s+Number(e.amount),0);
  const saldoPrevisto = balance + previstoIn - previstoOut;
  const planInfo = PLANS[accountData?.plan || "explorador"];
  const isAdmin = !demo && isAdminEmail(user?.email);
  const totalLancamentos = incomes.length + expenses.length;
  const planUsagePct = planInfo.limit === Infinity ? 0 : Math.round((totalLancamentos/planInfo.limit)*100);

  if (screen==="login") return (
    <>
    <InstallPrompt />
    <LoginScreen loading={loading} toast={toast} initialRef={refCode}
      onLogin={async(email,pass,reg,name,city,state,ref)=>{
        if(!fb){showToast("Firebase não configurado — use Demo","error");return;}
        setLoading(true);
        try{
          if(reg){
            const cred = await fb.createUserWithEmailAndPassword(fb.auth,email,pass);
            await fb.updateProfile(cred.user, { displayName: name });
            // Valida código de indicação (afiliado) se houver
            let referredBy = null;
            const code = (ref||"").trim().toUpperCase();
            if(code){
              try{
                const affDoc = await fb.getDoc(fb.doc(fb.db,"affiliates",code));
                if(affDoc.exists() && affDoc.data().active!==false) referredBy = code;
              }catch(e){}
            }
            // Salva perfil + indicação
            await fb.setDoc(fb.doc(fb.db,"accounts",cred.user.uid),{
              ownerId: cred.user.uid, ownerEmail: email, plan:"explorador",
              members:[email], createdAt:Date.now(), city, state,
              displayName: name, ...(referredBy?{referredBy}:{}),
            });
          } else {
            await fb.signInWithEmailAndPassword(fb.auth,email,pass);
          }
        } catch(e){ showToast(e.message,"error"); }
        setLoading(false);
      }}
      onForgot={async(email)=>{
        if(!fb){showToast("Firebase não configurado — use Demo","error");return;}
        const mail=(email||"").trim();
        if(!mail || mail.indexOf("@")<0){showToast("Digite seu e-mail no campo acima primeiro 🙂","error");return;}
        setLoading(true);
        try{
          await fb.sendPasswordResetEmail(fb.auth, mail);
          showToast("Enviamos um link pra redefinir sua senha 📩 Confere seu e-mail (e o spam).","success");
        } catch(e){ showToast(e.message,"error"); }
        setLoading(false);
      }}
      onDemo={()=>{
        setDemo(true);
        setUser({uid:"u1",email:"demo@igastei.com",displayName:"Demo"});
        setScreen("app");
      }}
    />
    </>
  );

  const content = (
    <>
      {tab==="dashboard"  && <Dashboard incomes={incomes} expenses={expenses} categories={categories} totalIn={totalIn} totalOut={totalOut} balance={balance} previstoIn={previstoIn} previstoOut={previstoOut} saldoPrevisto={saldoPrevisto} goal={goal} month={month} onGoal={saveGoal} histData={histData} onTab={setTab} planInfo={planInfo} totalLancamentos={totalLancamentos} onUpgrade={()=>setShowUpgrade(true)} isDesktop={isDesktop} />}
      {tab==="incomes"    && <Incomes   incomes={incomes}   categories={categories} onAdd={d=>addItem("incomes",d)}  onEdit={(id,d)=>editItem("incomes",id,d)}  onDelete={id=>deleteItem("incomes",id)}  onAddCat={addCategory} />}
      {tab==="expenses"   && <Expenses  expenses={expenses} categories={categories} onAdd={d=>addItem("expenses",d)} onEdit={(id,d)=>editItem("expenses",id,d)} onDelete={id=>deleteItem("expenses",id)} onAddCat={addCategory} />}
      {tab==="history"    && <History   incomes={incomes}   expenses={expenses} categories={categories} month={month} totalIn={totalIn} totalOut={totalOut} balance={balance} goal={goal} />}
      {tab==="categories" && <Categories categories={categories} expenses={expenses} incomes={incomes} onAdd={addCategory} onEdit={editCategory} />}
      {tab==="comparativo"&& <Comparativo histData={histData} month={month} />}
      {tab==="affiliates" && isAdmin && <Affiliates fb={fb} isDesktop={isDesktop} showToast={showToast} />}
      {tab==="account"    && <AccountSettings accountData={accountData} user={user} fb={fb} isAdmin={isAdmin} onTab={setTab} onUpgrade={()=>setShowUpgrade(true)} onSave={async (data)=>{ await fb.setDoc(fb.doc(fb.db,"accounts",user.uid),{...accountData,...data},{merge:true}); setAccountData(p=>({...p,...data})); showToast("Conta atualizada ✅"); }} />}
    </>
  );

  const overlays = (
    <>
      <InstallPrompt />
      {toast && <div style={{...S.toast, background: toast.type==="error"?"#FF3D7F":toast.type==="info"?"#3B7BFF":"#00B86B", color: toast.type==="success"?"#0D0D1A":"#fff"}}>{toast.msg}</div>}
      {showUpgrade && <UpgradeScreen user={user} accountData={accountData} fb={fb} onClose={()=>setShowUpgrade(false)}/>}
      {showSuccess && <UpgradeSuccess onClose={()=>setShowSuccess(false)}/>}
    </>
  );

  if (isDesktop) return (
    <div style={S.rootDesktop}>
      {overlays}
      <Sidebar tab={tab} onTab={setTab} demo={demo} onLogout={handleLogout} user={user} accountData={accountData} planInfo={planInfo} totalLancamentos={totalLancamentos} onUpgrade={()=>setShowUpgrade(true)} isAdmin={isAdmin} />
      <div style={S.dMain}>
        <TopBar month={month} onMonth={setMonth} demo={demo} onLogout={handleLogout} accountData={accountData} planInfo={planInfo} totalLancamentos={totalLancamentos} onUpgrade={()=>setShowUpgrade(true)} />
        <div style={S.dContent}>{content}</div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      {overlays}
      <Header month={month} onMonth={setMonth} demo={demo} onLogout={handleLogout}
        user={user} accountData={accountData} planInfo={planInfo}
        totalLancamentos={totalLancamentos} planUsagePct={planUsagePct} />
      <main style={S.main}>{content}</main>
      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}

// ============================================================
// SIDEBAR (desktop)
// ============================================================
const NAV_ITEMS=[
  {id:"dashboard",  icon:"🏠", label:"Início"},
  {id:"incomes",    icon:"💰", label:"Entradas"},
  {id:"expenses",   icon:"💸", label:"Gastos"},
  {id:"categories", icon:"🏷️", label:"Categorias"},
  {id:"history",    icon:"📋", label:"Histórico"},
  {id:"comparativo",icon:"📈", label:"Comparativo"},
  {id:"account",    icon:"👤", label:"Perfil"},
];

function Sidebar({tab,onTab,demo,onLogout,user,accountData,planInfo,totalLancamentos,onUpgrade,isAdmin}){
  const firstName = accountData?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "você";
  const isExplorador = planInfo?.limit !== Infinity;
  const items = isAdmin ? [...NAV_ITEMS, {id:"affiliates", icon:"🎯", label:"Afiliados"}] : NAV_ITEMS;
  return(
    <aside style={S.sidebar}>
      <div style={{padding:"22px 20px 14px"}}>
        <div style={{fontWeight:900,fontSize:23,letterSpacing:"-.5px"}}>💸 <span style={{background:"#00B86B",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>iGastei</span></div>
      </div>
      <nav style={{flex:1,padding:"6px 12px",display:"flex",flexDirection:"column",gap:4}}>
        {items.map(it=>(
          <button key={it.id} onClick={()=>onTab(it.id)}
            style={{...S.sideItem,...(tab===it.id?S.sideItemOn:{})}}>
            <span style={{fontSize:18,width:24,textAlign:"center"}}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      {isExplorador && !demo && (
        <div style={{margin:"0 14px 12px",background:"#FFFFFF",border:"1px solid #00FF8833",borderRadius:12,padding:14}}>
          <div style={{fontSize:12,color:"#00B86B",fontWeight:800}}>🎮 Modo Explorador</div>
          <div style={{fontSize:11,color:"#8A91A3",margin:"3px 0 8px"}}>{totalLancamentos}/10 lançamentos</div>
          <button style={{width:"100%",background:"#00B86B",border:"none",borderRadius:8,padding:"8px",fontWeight:800,fontSize:12,color:"#0D0D1A",cursor:"pointer"}} onClick={onUpgrade}>Fazer upgrade ⚡</button>
        </div>
      )}
      <div style={{borderTop:"1px solid #EEF0F4",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:"#00B86B",flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,color:"#0D0D1A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{firstName}</div>
          <div style={{fontSize:10,color:"#9AA1B2"}}>{demo?"Demo":planInfo?.name}</div>
        </div>
        <button style={{background:"none",border:"1px solid #EEF0F4",borderRadius:8,color:"#8A91A3",fontSize:12,padding:"6px 10px",cursor:"pointer"}} onClick={onLogout}>Sair</button>
      </div>
    </aside>
  );
}

// ============================================================
// TOPBAR (desktop)
// ============================================================
function TopBar({month,onMonth,accountData,planInfo}){
  const [y,m]=month.split("-").map(Number);
  const prev=()=>{ const d=new Date(y,m-2,1); onMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const next=()=>{ const d=new Date(y,m,1);   onMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const firstName = accountData?.displayName?.split(" ")[0] || "você";
  return(
    <header style={S.topbar}>
      <div>
        <div style={{fontSize:12,color:"#8A91A3"}}>olá,</div>
        <div style={{fontWeight:800,fontSize:18,color:"#0D0D1A"}}>{firstName} 👋</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#FFFFFF",border:"1px solid #EEF0F4",borderRadius:10,padding:"6px 8px"}}>
          <button style={S.monthBtn} onClick={prev}>‹</button>
          <span style={{fontWeight:700,fontSize:14,minWidth:96,textAlign:"center"}}>{MONTHS[m-1]} {y}</span>
          <button style={S.monthBtn} onClick={next}>›</button>
        </div>
        {planInfo?.limit===Infinity && <span style={{fontSize:12,fontWeight:800,color:"#0D0D1A",background:"#00B86B",padding:"6px 12px",borderRadius:100}}>{planInfo.name}</span>}
      </div>
    </header>
  );
}

// ============================================================
// LOGIN / CADASTRO
// ============================================================
const STATES_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function LoginScreen({onLogin,onForgot,onDemo,loading,toast,initialRef}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [state,setState]=useState("SP");
  const [ref,setRef]=useState(initialRef||"");
  const [reg,setReg]=useState(!!initialRef);

  return(
    <div style={S.loginRoot}>
      {toast && <div style={{...S.toast,background:toast.type==="error"?"#FF3D7F":"#00B86B",color:toast.type==="success"?"#0D0D1A":"#fff"}}>{toast.msg}</div>}
      <div style={S.loginCard}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:4}}>💸</div>
          <div style={{fontWeight:900,fontSize:28,background:"#00B86B",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-1px"}}>iGastei</div>
          <div style={{fontSize:13,color:"#8A91A3",marginTop:4}}>{reg?"Cria sua conta grátis":"Bem-vindo de volta"}</div>
        </div>

        {reg && (
          <div style={S.fg}>
            <label style={S.label}>Como você quer ser chamado</label>
            <input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Yuri, Ju, Pedrão..."/>
          </div>
        )}

        <div style={S.fg}><label style={S.label}>E-mail</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com"/>
        </div>
        <div style={S.fg}><label style={S.label}>Senha</label>
          <input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"/>
        </div>

        {reg && (
          <div style={{display:"flex",gap:8}}>
            <div style={{...S.fg,flex:2}}><label style={S.label}>Cidade</label>
              <input style={S.input} value={city} onChange={e=>setCity(e.target.value)} placeholder="Sua cidade"/>
            </div>
            <div style={{...S.fg,flex:1}}><label style={S.label}>Estado</label>
              <select style={S.input} value={state} onChange={e=>setState(e.target.value)}>
                {STATES_BR.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {reg && (
          <div style={S.fg}>
            <label style={S.label}>Código de indicação (opcional)</label>
            <input style={S.input} value={ref} onChange={e=>setRef(e.target.value.toUpperCase())} placeholder="Ex: MARIA10"/>
          </div>
        )}

        <button style={S.btnPrimary} onClick={()=>onLogin(email,pass,reg,name,city,state,ref)} disabled={loading}>
          {loading?"Aguarda...":reg?"Criar conta grátis":"Entrar"}
        </button>

        <button style={S.btnLink} onClick={()=>setReg(!reg)}>
          {reg?"Já tenho conta →":"Não tenho conta. Criar grátis →"}
        </button>

        {!reg && onForgot && (
          <button style={{...S.btnLink,color:"#8A91A3",fontSize:13,marginTop:2}} onClick={()=>onForgot(email)} disabled={loading}>
            Esqueci minha senha
          </button>
        )}

        {reg && (
          <div style={{background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:10,padding:12,marginTop:8}}>
            <div style={{fontSize:12,color:"#00B86B",fontWeight:700,marginBottom:4}}>🎮 Modo Explorador (grátis)</div>
            <div style={{fontSize:11,color:"#8A91A3"}}>10 lançamentos/mês pra você sentir o app. Depois é só fazer upgrade!</div>
          </div>
        )}

        <div style={{textAlign:"center",color:"#9AA1B2",margin:"16px 0",borderTop:"1px solid #EEF0F4",lineHeight:0}}>
          <span style={{background:"#ECEEF2",padding:"0 12px",color:"#9AA1B2",fontSize:12}}>ou</span>
        </div>
        <button style={S.btnGhost} onClick={onDemo}>🎮 Experimentar sem cadastro</button>
      </div>
    </div>
  );
}

// ============================================================
// HEADER
// ============================================================
function Header({month,onMonth,demo,onLogout,user,accountData,planInfo,totalLancamentos,planUsagePct}){
  const [y,m]=month.split("-").map(Number);
  const prev=()=>{ const d=new Date(y,m-2,1); onMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const next=()=>{ const d=new Date(y,m,1);   onMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const firstName = accountData?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "você";
  const planName = demo ? "Modo demonstração" : (planInfo?.name || (accountData?.plan==="explorador"?"Explorador":"Pro"));
  return(
    <header style={S.header}>
      <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
        <div style={S.avatar}>{firstName[0]?.toUpperCase()}</div>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:900,fontSize:16,color:"#0D0D1A",letterSpacing:"-.02em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Olá, {firstName}</div>
          <div style={{fontSize:12,color:"#8A91A3",fontWeight:700}}>{planName}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={S.monthSel}>
          <button style={S.monthBtn} onClick={prev} aria-label="mês anterior">‹</button>
          <span style={{fontSize:13.5,fontWeight:800,minWidth:58,textAlign:"center",color:"#0D0D1A"}}>{MONTHS[m-1]} {String(y).slice(2)}</span>
          <button style={S.monthBtn} onClick={next} aria-label="próximo mês">›</button>
        </div>
        <button style={S.btnLogout} onClick={onLogout}>Sair</button>
      </div>
    </header>
  );
}

// ============================================================
// BOTTOM NAV
// ============================================================
function BottomNav({tab,onTab}){
  const tabs=[
    {id:"dashboard",  icon:"🏠", label:"Início"},
    {id:"expenses",   icon:"💸", label:"Gastos"},
    {id:"incomes",    icon:"💰", label:"Entradas"},
    {id:"history",    icon:"📋", label:"Histórico"},
    {id:"account",    icon:"👤", label:"Perfil"},
  ];
  return(
    <nav style={S.bottomNav}>
      {tabs.map((t,i)=>{
        const isCenter = i===2;
        return(
          <button key={t.id}
            style={isCenter ? S.bottomNavCenter : {...S.bottomNavBtn,...(tab===t.id?S.bottomNavBtnOn:{})}}
            onClick={()=>onTab(t.id)}>
            <span style={{fontSize:isCenter?22:18}}>{t.icon}</span>
            {!isCenter && <span style={{fontSize:9,fontWeight:600,marginTop:2}}>{t.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({incomes,expenses,categories,totalIn,totalOut,balance,previstoIn,previstoOut,saldoPrevisto,goal,month,onGoal,histData,onTab,planInfo,totalLancamentos,onUpgrade,isDesktop}){
  const [editGoal,setEditGoal]=useState(false);
  const [gInput,setGInput]=useState(goal);
  const saved=balance;
  const goalPct=goal>0?Math.min(100,Math.round((saved/goal)*100)):0;
  const isExplorador = planInfo?.limit !== Infinity;
  const [,mm]=month.split("-").map(Number);
  const mName=(MONTHS[mm-1]||"").toLowerCase();
  const num={fontVariantNumeric:"tabular-nums"};

  const byCatExp={};
  expenses.forEach(e=>{ byCatExp[e.category]=(byCatExp[e.category]||0)+Number(e.amount); });

  const byPerson={};
  incomes.forEach(i=>{ const k=i.userName||"—"; if(!byPerson[k]) byPerson[k]={in:0,out:0}; byPerson[k].in+=Number(i.amount); });
  expenses.forEach(e=>{ const k=e.userName||"—"; if(!byPerson[k]) byPerson[k]={in:0,out:0}; byPerson[k].out+=Number(e.amount); });

  const Card = {background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:18,padding:18};
  const CTitle = {fontWeight:900,fontSize:16,color:"#0D0D1A"};
  const CSub = {color:"#8A91A3",fontWeight:800,fontSize:12.5};

  const banner = isExplorador && (
    <div style={Card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,color:"#00B86B",fontWeight:900}}>Modo Explorador</div>
          <div style={{fontSize:12.5,color:"#8A91A3",marginTop:2,fontWeight:700}}>{totalLancamentos}/10 lançamentos este mês</div>
        </div>
        <button onClick={onUpgrade} style={{background:"#00B86B",color:"#04120a",border:"none",borderRadius:12,padding:"12px 16px",fontWeight:900,fontSize:13.5,cursor:"pointer",minHeight:44,whiteSpace:"nowrap"}}>Virar Pro ⚡</button>
      </div>
      <div style={{marginTop:12,height:8,background:"#EEF0F4",borderRadius:5,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,(totalLancamentos/10)*100)}%`,background:"#00B86B",borderRadius:5,transition:"width .5s"}}/>
      </div>
    </div>
  );

  const heroSaldo = (
    <div style={{background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:22,padding:isDesktop?24:22}}>
      <div style={CSub}>Saldo atual · {mName}</div>
      <div style={{fontWeight:900,fontSize:isDesktop?44:46,color:balance>=0?"#00B86B":"#FF3D7F",letterSpacing:"-.03em",lineHeight:1,marginTop:8,...num}}>{fmt(balance)}</div>
      <div style={{display:"inline-block",marginTop:14,background:balance>=0?"#00FF8818":"#FF3D7F18",color:balance>=0?"#00B86B":"#FF3D7F",fontWeight:800,fontSize:12.5,padding:"6px 12px",borderRadius:10}}>{balance>=0?"✓ tudo certo, sobra no mês":"⚠️ os gastos passaram das entradas"}</div>
    </div>
  );

  const statEntradas = (
    <div style={Card}>
      <div style={CSub}>Entradas</div>
      <div style={{fontWeight:900,fontSize:23,color:"#00B86B",marginTop:6,letterSpacing:"-.02em",...num}}>{fmt(totalIn)}</div>
      <div style={{fontSize:11.5,color:"#9AA1B2",fontWeight:700,marginTop:2}}>{incomes.length} lançamentos</div>
    </div>
  );
  const statGastos = (
    <div style={Card}>
      <div style={CSub}>Gastos</div>
      <div style={{fontWeight:900,fontSize:23,color:"#FF3D7F",marginTop:6,letterSpacing:"-.02em",...num}}>{fmt(totalOut)}</div>
      <div style={{fontSize:11.5,color:"#9AA1B2",fontWeight:700,marginTop:2}}>{expenses.length} lançamentos</div>
    </div>
  );

  const temPrevisto = previstoIn>0 || previstoOut>0;
  const previstoCard = temPrevisto && (
    <div style={Card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{...CTitle,color:"#E8930A"}}>Previsto do mês</span>
        <span style={CSub}>a pagar e a receber</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
        <div><div style={{fontSize:12,color:"#8A91A3",fontWeight:700}}>a receber</div><div style={{fontWeight:900,fontSize:18,color:"#00B86B",marginTop:3,...num}}>+{fmt(previstoIn)}</div></div>
        <div><div style={{fontSize:12,color:"#8A91A3",fontWeight:700}}>a pagar</div><div style={{fontWeight:900,fontSize:18,color:"#FF3D7F",marginTop:3,...num}}>-{fmt(previstoOut)}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:12,color:"#8A91A3",fontWeight:700}}>saldo previsto</div><div style={{fontWeight:900,fontSize:20,color:saldoPrevisto>=0?"#E8930A":"#FF3D7F",marginTop:3,...num}}>{fmt(saldoPrevisto)}</div></div>
      </div>
      <div style={{fontSize:12,color:"#9AA1B2",marginTop:12,lineHeight:1.4,fontWeight:600}}>Saldo atual ({fmt(balance)}) + o que ainda entra − o que ainda sai.</div>
    </div>
  );

  const metaCard = (
    <div style={Card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:editGoal?12:8}}>
        <span style={CTitle}>Meta de economia</span>
        {!editGoal && <button style={S.btnSm} onClick={()=>{setEditGoal(true);setGInput(goal);}}>editar</button>}
      </div>
      {editGoal?(
        <div style={{display:"flex",gap:8}}>
          <input style={{...S.input,flex:1}} type="number" value={gInput} onChange={e=>setGInput(Number(e.target.value))} placeholder="Ex: 2000"/>
          <button style={{...S.btnPrimary,width:"auto",padding:"0 18px"}} onClick={()=>{onGoal(gInput);setEditGoal(false);}}>salvar</button>
          <button style={{...S.btnGhost,width:"auto",padding:"0 14px"}} onClick={()=>setEditGoal(false)}>x</button>
        </div>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,marginBottom:8}}>
            <span style={{color:"#555c6b",...num}}>{fmt(saved)} <span style={{color:"#8A91A3",fontWeight:700}}>de {fmt(goal)}</span></span>
            <span style={{color:goalPct>=100?"#00B86B":"#E8930A"}}>{goalPct}%</span>
          </div>
          <ProgressBar pct={goalPct} color={goalPct>=100?"#00B86B":"#E8930A"}/>
        </>
      )}
    </div>
  );

  const porPessoaCard = Object.keys(byPerson).length>0 && (
    <div style={Card}>
      <div style={{...CTitle,marginBottom:14}}>Por pessoa</div>
      {Object.entries(byPerson).map(([name,v])=>(
        <div key={name} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:40,height:40,background:"#EEF0F4",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#0D0D1A",fontSize:16,flexShrink:0}}>{name[0]?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:800,fontSize:14.5,color:"#0D0D1A"}}>{name}</div>
            <div style={{display:"flex",gap:12,fontSize:12.5,marginTop:2,fontWeight:700,...num}}>
              <span style={{color:"#00B86B"}}>+{fmt(v.in)}</span>
              <span style={{color:"#FF3D7F"}}>-{fmt(v.out)}</span>
            </div>
          </div>
          <div style={{fontWeight:900,fontSize:15,color:v.in-v.out>=0?"#E8930A":"#FF3D7F",...num}}>{fmt(v.in-v.out)}</div>
        </div>
      ))}
    </div>
  );

  const categoriaCard = Object.keys(byCatExp).length>0 && (
    <div style={Card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={CTitle}>Gastos por categoria</span>
        <span style={CSub}>{mName}</span>
      </div>
      {Object.entries(byCatExp).sort((a,b)=>b[1]-a[1]).slice(0,isDesktop?8:5).map(([cid,val])=>{
        const cat=categories.find(c=>c.id===cid)||{label:prettyCat(cid),icon:"📦",color:"#8A91A3"};
        const pct=totalOut>0?(val/totalOut)*100:0;
        return(
          <div key={cid} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <span style={{fontSize:14.5,fontWeight:800,color:"#0D0D1A"}}>{cat.icon} {cat.label}</span>
              <span style={{fontWeight:900,fontSize:14.5,color:cat.color,...num}}>{fmt(val)}</span>
            </div>
            <ProgressBar pct={pct} color={cat.color}/>
          </div>
        );
      })}
    </div>
  );

  const comparativoCard = histData&&histData.length>0 && (
    <div style={Card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={CTitle}>Comparativo</span>
        <button style={S.btnSm} onClick={()=>onTab("comparativo")}>ver tudo →</button>
      </div>
      <div style={{display:"flex",gap:isDesktop?10:7,alignItems:"flex-end"}}>
        {histData.map((d)=>{
          const [,m2]=d.month.split("-").map(Number);
          const maxVal=Math.max(...histData.map(x=>Math.max(x.totalIn,x.totalOut)),1);
          const hOut=Math.round((d.totalOut/maxVal)*100);
          const isCurrent=d.month===month;
          return(
            <div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <div style={{width:"100%",height:isDesktop?100:64,display:"flex",alignItems:"flex-end"}}>
                <div style={{width:"100%",height:`${hOut}%`,background:isCurrent?"#FF3D7F":"#E4E7EE",borderRadius:"7px 7px 2px 2px",minHeight:4}}/>
              </div>
              <span style={{fontSize:11,color:isCurrent?"#00B86B":"#9AA1B2",fontWeight:isCurrent?900:700}}>{MONTHS[m2-1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isDesktop) return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {banner}
      {heroSaldo}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>{statEntradas}{statGastos}</div>
      {previstoCard}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>{metaCard}{porPessoaCard}</div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>{categoriaCard}{comparativoCard}</div>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,paddingBottom:16}}>
      {banner}
      {heroSaldo}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{statEntradas}{statGastos}</div>
      {previstoCard}
      {metaCard}
      {categoriaCard}
      {porPessoaCard}
      {comparativoCard}
    </div>
  );
}

function ProgressBar({pct,color}){
  return <div style={{height:12,background:"#EEF0F4",borderRadius:7,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:color,borderRadius:7,transition:"width .5s"}}/></div>;
}

// ============================================================
// ITEM FORM
// ============================================================
function ItemForm({type,categories,item,onSave,onClose,onAddCat}){
  const isIncome=type==="income";
  const validCats=categories.filter(c=>c.type===type||c.type==="both");
  const [desc,setDesc]=useState(item?.description||"");
  const [amt,setAmt]=useState(item?.amount?String(Math.round(Number(item.amount)*100)):""); // guarda os dígitos (centavos)
  const [cat,setCat]=useState(item?.category||(validCats[0]?.id||"outros"));
  const [date,setDate]=useState(item?.date||todayStr());
  const [newCat,setNewCat]=useState(false);
  const [ncLabel,setNcLabel]=useState("");
  const [ncIcon,setNcIcon]=useState(isIncome?"💡":"📌");
  const [ncColor,setNcColor]=useState(isIncome?"#00B86B":"#3B7BFF");
  const [status,setStatus]=useState(item?.status==="previsto"?"previsto":"pago");
  const [recorrente,setRecorrente]=useState(!!item?.recorrente);

  const saveNewCat=()=>{
    if(!ncLabel)return;
    const id=ncLabel.toLowerCase().replace(/\s+/g,"_")+Date.now();
    onAddCat({id,label:ncLabel,icon:ncIcon,color:ncColor,type});
    setCat(id); setNewCat(false); setNcLabel("");
  };

  return(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{color:"#0D0D1A",fontWeight:800,fontSize:16,margin:0}}>{item?"Editar":"Nova"} {isIncome?"entrada":"despesa"}</h3>
          <button style={{background:"none",border:"none",color:"#8A91A3",fontSize:20,cursor:"pointer"}} onClick={onClose}>✕</button>
        </div>

        <div style={S.fg}><label style={S.label}>Descrição</label>
          <input style={S.input} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={isIncome?"Ex: Salário":"Ex: Aluguel"}/>
        </div>

        <div style={{display:"flex",gap:10}}>
          <div style={{...S.fg,flex:1}}><label style={S.label}>Valor (R$)</label>
            <input style={S.input} type="text" inputMode="numeric" value={amt?maskMoney(amt):""} onChange={e=>setAmt(e.target.value.replace(/\D/g,""))} placeholder="0,00"/>
          </div>
          <div style={{...S.fg,flex:1}}><label style={S.label}>{status==="previsto"?"Vence em":"Data"}</label>
            <input style={S.input} inputMode="numeric" value={date} onChange={e=>setDate(maskDate(e.target.value))} placeholder="DD/MM/AAAA"/>
          </div>
        </div>

        <div style={S.fg}>
          <label style={S.label}>Situação</label>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setStatus("pago")} style={{flex:1,padding:"11px 8px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",border:`2px solid ${status==="pago"?(isIncome?"#00B86B":"#FF3D7F"):"#EEF0F4"}`,background:status==="pago"?(isIncome?"rgba(0,255,136,.13)":"rgba(255,61,127,.13)"):"#0D0D1A",color:"#0D0D1A"}}>{isIncome?"✅ Já recebi":"✅ Já paguei"}</button>
            <button type="button" onClick={()=>setStatus("previsto")} style={{flex:1,padding:"11px 8px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",border:`2px solid ${status==="previsto"?"#E8930A":"#EEF0F4"}`,background:status==="previsto"?"rgba(255,214,10,.13)":"#0D0D1A",color:"#0D0D1A"}}>📅 {isIncome?"A receber":"A pagar"}</button>
          </div>
          {status==="previsto" && (
            <label style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:13,color:"#8A91A3",cursor:"pointer"}}>
              <input type="checkbox" checked={recorrente} onChange={e=>setRecorrente(e.target.checked)} style={{width:18,height:18,accentColor:"#E8930A"}}/>
              🔁 Repete todo mês (conta fixa)
            </label>
          )}
        </div>

        <div style={S.fg}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={S.label}>Categoria</label>
            <button style={S.btnSm} onClick={()=>setNewCat(!newCat)}>{newCat?"cancelar":"+ nova"}</button>
          </div>
          {newCat?(
            <div style={{background:"#ECEEF2",borderRadius:10,padding:12,marginBottom:8}}>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input style={{...S.input,flex:"0 0 55px",textAlign:"center",fontSize:20,padding:"6px"}} value={ncIcon} onChange={e=>setNcIcon(e.target.value)}/>
                <input style={{...S.input,flex:1}} value={ncLabel} onChange={e=>setNcLabel(e.target.value)} placeholder="Nome da categoria"/>
                <input style={{...S.input,flex:"0 0 42px",padding:4,height:42}} type="color" value={ncColor} onChange={e=>setNcColor(e.target.value)}/>
              </div>
              <button style={{...S.btnPrimary,fontSize:13}} onClick={saveNewCat}>Criar e selecionar</button>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,maxHeight:200,overflowY:"auto"}}>
              {validCats.map(c=>(
                <button key={c.id} onClick={()=>setCat(c.id)}
                  style={{background:cat===c.id?c.color+"22":"#0D0D1A",border:`2px solid ${cat===c.id?c.color:"#EEF0F4"}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:"#0D0D1A",fontSize:12,fontWeight:600,transition:"all .15s"}}>
                  <span style={{fontSize:18}}>{c.icon}</span>
                  <span style={{flex:1,textAlign:"left",fontSize:11}}>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button style={{...S.btnPrimary,background:isIncome?"#00B86B":"#FF3D7F",color:isIncome?"#0D0D1A":"#fff",marginTop:8}}
          onClick={()=>{ if(!desc||!amt)return; onSave({description:desc,amount:Number(amt)/100,category:cat,date,status,recorrente}); }}>
          {item?"Atualizar":"Salvar"} {isIncome?"entrada":"gasto"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// INCOMES
// ============================================================
function Incomes({incomes,categories,onAdd,onEdit,onDelete,onAddCat}){
  const [form,setForm]=useState(null);
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?incomes:incomes.filter(i=>i.category===filter);
  const activeCats=[...new Set(incomes.map(i=>i.category))].map(id=>catOf(categories,id,"💼","#00B86B"));
  const totalAll=incomes.reduce((s,i)=>s+Number(i.amount),0);
  const totalFiltered=filtered.reduce((s,i)=>s+Number(i.amount),0);
  const filterCat=filter!=="all"?catOf(categories,filter,"💼","#00B86B"):null;

  return(
    <div style={{paddingBottom:80}}>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>💰 Entradas</h2>
        <button style={S.btnPrimary} onClick={()=>setForm("new")}>+ Adicionar</button>
      </div>
      {form && <ItemForm type="income" categories={categories} item={form==="new"?null:form} onAddCat={onAddCat} onSave={d=>{ form==="new"?onAdd(d):onEdit(form.id,d); setForm(null); }} onClose={()=>setForm(null)}/>}

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        <button style={{...S.chip,...(filter==="all"?S.chipOn:{})}} onClick={()=>setFilter("all")}>Todos</button>
        {activeCats.map(c=>(
          <button key={c.id} style={{...S.chip,...(filter===c.id?{...S.chipOn,background:c.color,color:"#0D0D1A"}:{})}} onClick={()=>setFilter(filter===c.id?"all":c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {filter==="all" && incomes.length>0 && (
        <div style={{...S.card,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px"}}>
          <span style={{fontSize:12,color:"#8A91A3",fontWeight:600}}>💰 Total do mês</span>
          <span style={{fontWeight:900,fontSize:16,color:"#00B86B"}}>+{fmt(totalAll)}</span>
        </div>
      )}
      {filter!=="all" && filterCat && (
        <div style={{...S.card,marginBottom:10,borderLeft:`3px solid ${filterCat.color}`,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#8A91A3",fontWeight:600}}>{filterCat.icon} {filterCat.label}</div>
              <div style={{fontSize:11,color:"#9AA1B2",marginTop:2}}>{filtered.length} lançamento{filtered.length!==1?"s":""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:17,color:"#00B86B"}}>+{fmt(totalFiltered)}</div>
              <div style={{fontSize:11,color:"#9AA1B2"}}>{totalAll>0?((totalFiltered/totalAll)*100).toFixed(1):0}% do total</div>
            </div>
          </div>
        </div>
      )}

      {filtered.length===0 && <p style={S.empty}>Nenhuma entrada {filter!=="all"?"nesta categoria":"este mês"}</p>}
      {[...filtered].sort((a,b)=>(a.status==="previsto"?-1:0)-(b.status==="previsto"?-1:0)||b.createdAt-a.createdAt).map(inc=>{
        const cat=categories.find(c=>c.id===inc.category)||{icon:"💼",color:"#00B86B",label:prettyCat(inc.category)};
        const previsto=inc.status==="previsto";
        return(
          <div key={inc.id} style={{...S.listItem,...(previsto?{border:"1px solid #FFD60A44"}:{})}}>
            <div style={{...S.listIcon,background:cat.color+"22"}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0D0D1A"}}>{inc.description} {previsto&&<span style={{fontSize:10,fontWeight:700,color:"#E8930A",background:"rgba(255,214,10,.13)",borderRadius:6,padding:"1px 6px",marginLeft:2}}>📅 a receber{inc.recorrente?" 🔁":""}</span>}</div>
              <div style={{fontSize:11,color:"#9AA1B2"}}>{previsto?`vence ${inc.date}`:inc.date} · {inc.userName} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#00B86B",opacity:previsto?0.6:1}}>+{fmt(inc.amount)}</div>
            <div style={{display:"flex",gap:2}}>
              {previsto&&<button style={{...S.btnIcon,color:"#00B86B"}} title="Marcar como recebido" onClick={()=>onEdit(inc.id,{status:"pago"})}>✅</button>}
              <button style={S.btnIcon} onClick={()=>setForm(inc)}>✏️</button>
              <button style={S.btnIcon} onClick={()=>onDelete(inc.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// EXPENSES
// ============================================================
function Expenses({expenses,categories,onAdd,onEdit,onDelete,onAddCat}){
  const [form,setForm]=useState(null);
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?expenses:expenses.filter(e=>e.category===filter);
  const activeCats=[...new Set(expenses.map(e=>e.category))].map(id=>catOf(categories,id));
  const totalAll=expenses.reduce((s,e)=>s+Number(e.amount),0);
  const totalFiltered=filtered.reduce((s,e)=>s+Number(e.amount),0);
  const filterCat=filter!=="all"?catOf(categories,filter):null;

  return(
    <div style={{paddingBottom:80}}>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>💸 Gastos</h2>
        <button style={{...S.btnPrimary,background:"#FF3D7F",color:"#fff"}} onClick={()=>setForm("new")}>+ Adicionar</button>
      </div>
      {form && <ItemForm type="expense" categories={categories} item={form==="new"?null:form} onAddCat={onAddCat} onSave={d=>{ form==="new"?onAdd(d):onEdit(form.id,d); setForm(null); }} onClose={()=>setForm(null)}/>}

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        <button style={{...S.chip,...(filter==="all"?S.chipOn:{})}} onClick={()=>setFilter("all")}>Todos</button>
        {activeCats.map(c=>(
          <button key={c.id} style={{...S.chip,...(filter===c.id?{...S.chipOn,background:c.color,color:"#0D0D1A"}:{})}} onClick={()=>setFilter(filter===c.id?"all":c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {filter==="all" && expenses.length>0 && (
        <div style={{...S.card,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px"}}>
          <span style={{fontSize:12,color:"#8A91A3",fontWeight:600}}>💸 Total do mês</span>
          <span style={{fontWeight:900,fontSize:16,color:"#FF3D7F"}}>-{fmt(totalAll)}</span>
        </div>
      )}
      {filter!=="all" && filterCat && (
        <div style={{...S.card,marginBottom:10,borderLeft:`3px solid ${filterCat.color}`,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#8A91A3",fontWeight:600}}>{filterCat.icon} {filterCat.label}</div>
              <div style={{fontSize:11,color:"#9AA1B2",marginTop:2}}>{filtered.length} lançamento{filtered.length!==1?"s":""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:17,color:"#FF3D7F"}}>-{fmt(totalFiltered)}</div>
              <div style={{fontSize:11,color:"#9AA1B2"}}>{totalAll>0?((totalFiltered/totalAll)*100).toFixed(1):0}% do total</div>
            </div>
          </div>
        </div>
      )}

      {filtered.length===0 && <p style={S.empty}>Nenhum gasto {filter!=="all"?"nesta categoria":"este mês"}</p>}
      {[...filtered].sort((a,b)=>(a.status==="previsto"?-1:0)-(b.status==="previsto"?-1:0)||b.createdAt-a.createdAt).map(exp=>{
        const cat=categories.find(c=>c.id===exp.category)||{icon:"📦",color:"#8A91A3",label:prettyCat(exp.category)};
        const previsto=exp.status==="previsto";
        return(
          <div key={exp.id} style={{...S.listItem,...(previsto?{border:"1px solid #FFD60A44"}:{})}}>
            <div style={{...S.listIcon,background:cat.color+"22"}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0D0D1A"}}>{exp.description} {previsto&&<span style={{fontSize:10,fontWeight:700,color:"#E8930A",background:"rgba(255,214,10,.13)",borderRadius:6,padding:"1px 6px",marginLeft:2}}>📅 a pagar{exp.recorrente?" 🔁":""}</span>}</div>
              <div style={{fontSize:11,color:"#9AA1B2"}}>{previsto?`vence ${exp.date}`:exp.date} · {exp.userName} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#FF3D7F",opacity:previsto?0.6:1}}>-{fmt(exp.amount)}</div>
            <div style={{display:"flex",gap:2}}>
              {previsto&&<button style={{...S.btnIcon,color:"#00B86B"}} title="Marcar como pago" onClick={()=>onEdit(exp.id,{status:"pago"})}>✅</button>}
              <button style={S.btnIcon} onClick={()=>setForm(exp)}>✏️</button>
              <button style={S.btnIcon} onClick={()=>onDelete(exp.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// HISTORY + PDF
// ============================================================
function History({incomes,expenses,categories,month,totalIn,totalOut,balance,goal}){
  const [y,m]=month.split("-").map(Number);
  const monthLabel=`${MONTHS[m-1]} ${y}`;
  const all=[...incomes.map(i=>({...i,kind:"income"})),...expenses.map(e=>({...e,kind:"expense"}))].sort((a,b)=>b.createdAt-a.createdAt);

  const generatePDF=()=>{
    const byCat={};
    expenses.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+Number(e.amount); });
    const rows=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cid,v])=>{
      const cat=categories.find(c=>c.id===cid)||{label:prettyCat(cid),icon:"📦"};
      return `<tr><td>${cat.icon} ${cat.label}</td><td style="text-align:right;color:#FF3D7F">${fmt(v)}</td><td style="text-align:right">${totalOut>0?((v/totalOut)*100).toFixed(1)+"%":"-"}</td></tr>`;
    }).join("");
    const incRows=incomes.map(i=>{ const cat=categories.find(c=>c.id===i.category)||{label:prettyCat(i.category),icon:"💰"}; return `<tr><td>${i.date}</td><td>${i.description}</td><td>${i.userName||"—"}</td><td>${cat.icon} ${cat.label}</td><td style="color:#00B86B;text-align:right">+${fmt(i.amount)}</td></tr>`; }).join("");
    const expRows=expenses.map(e=>{ const cat=categories.find(c=>c.id===e.category)||{label:prettyCat(e.category),icon:"📦"}; return `<tr><td>${e.date}</td><td>${e.description}</td><td>${e.userName||"—"}</td><td>${cat.icon} ${cat.label}</td><td style="color:#FF3D7F;text-align:right">-${fmt(e.amount)}</td></tr>`; }).join("");
    const saved=totalIn-totalOut;
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>iGastei – ${monthLabel}</title><style>*{box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;max-width:800px;margin:0 auto;background:#0D0D1A;}h1{color:#0D0D1A;font-size:26px;}h2{color:#3B7BFF;font-size:16px;margin:24px 0 8px;border-bottom:2px solid #0D0D1A;padding-bottom:4px;}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0;}.card{border-radius:10px;padding:14px;text-align:center;}.g{background:#E7F8EF;}.r{background:#FDECEF;}.b{background:#E7F8EF;}.val{font-size:18px;font-weight:900;margin:4px 0;}.lbl{font-size:11px;color:#64748b;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#0D0D1A;padding:7px 8px;text-align:left;font-weight:700;}td{padding:6px 8px;border-bottom:1px solid #0D0D1A;}.meta{background:#E7F8EF;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;}@media print{button{display:none!important;}}</style></head><body>
<h1>💸 iGastei — ${monthLabel}</h1>
<div class="cards"><div class="card g"><div class="lbl">Entradas</div><div class="val" style="color:#16a34a">${fmt(totalIn)}</div></div><div class="card r"><div class="lbl">Gastos</div><div class="val" style="color:#E23D5B">${fmt(totalOut)}</div></div><div class="card b"><div class="lbl">Saldo</div><div class="val" style="color:${saved>=0?"#7c3aed":"#E8930A"}">${fmt(saved)}</div></div></div>
<h2>💰 Entradas</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${incRows||"<tr><td colspan=5>Nenhuma entrada</td></tr>"}</tbody></table>
<h2>💸 Gastos</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${expRows||"<tr><td colspan=5>Nenhum gasto</td></tr>"}</tbody></table>
<h2>🏷️ Por categoria</h2><table><thead><tr><th>Categoria</th><th>Valor</th><th>%</th></tr></thead><tbody>${rows||"<tr><td colspan=3>Sem dados</td></tr>"}</tbody></table>
<script>window.onload=()=>window.print();</script></body></html>`;
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html"})),"_blank");
  };

  return(
    <div style={{paddingBottom:80}}>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>📋 Histórico</h2>
        <button style={{...S.btnPrimary,width:"auto",padding:"10px 14px",fontSize:12}} onClick={generatePDF}>📄 PDF</button>
      </div>
      <div style={{...S.card,marginBottom:12,padding:"10px 14px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
          <div><div style={{fontWeight:800,fontSize:14,color:"#00B86B"}}>{fmt(totalIn)}</div><div style={{fontSize:10,color:"#9AA1B2"}}>Entradas</div></div>
          <div><div style={{fontWeight:800,fontSize:14,color:"#FF3D7F"}}>{fmt(totalOut)}</div><div style={{fontSize:10,color:"#9AA1B2"}}>Gastos</div></div>
          <div><div style={{fontWeight:800,fontSize:14,color:balance>=0?"#E8930A":"#FF3D7F"}}>{fmt(balance)}</div><div style={{fontSize:10,color:"#9AA1B2"}}>Saldo</div></div>
        </div>
      </div>
      {all.length===0 && <p style={S.empty}>Nenhum lançamento este mês</p>}
      {all.map(item=>{
        const cat=categories.find(c=>c.id===item.category)||{icon:item.kind==="income"?"💰":"📦",color:item.kind==="income"?"#00B86B":"#8A91A3",label:prettyCat(item.category)};
        const isIn=item.kind==="income";
        return(
          <div key={item.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22"}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"#0D0D1A",display:"flex",alignItems:"center",gap:6}}>
                {item.description}
                <span style={{fontSize:9,background:isIn?"#00FF8822":"#FF3D7F22",color:isIn?"#00B86B":"#FF3D7F",borderRadius:4,padding:"2px 6px",fontWeight:700}}>{isIn?"ENTRADA":"GASTO"}</span>
              </div>
              <div style={{fontSize:11,color:"#9AA1B2"}}>{item.date} · {item.userName||"—"} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:13,color:isIn?"#00B86B":"#FF3D7F"}}>{isIn?"+":"-"}{fmt(item.amount)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// COMPARATIVO
// ============================================================
function Comparativo({histData,month}){
  if(!histData||histData.length===0) return(
    <div style={{paddingBottom:80}}>
      <h2 style={S.secTitle}>📈 Comparativo</h2>
      <p style={S.empty}>Lance dados em meses anteriores para ver o comparativo aqui.</p>
    </div>
  );
  return(
    <div style={{paddingBottom:80}}>
      <h2 style={{...S.secTitle,marginBottom:14}}>📈 Comparativo de meses</h2>
      {[...histData].reverse().map(d=>{
        const [y2,m2]=d.month.split("-").map(Number);
        const isCurrent=d.month===month;
        const maxVal=Math.max(...histData.map(x=>Math.max(x.totalIn,x.totalOut)),1);
        const pctIn=Math.round((d.totalIn/maxVal)*100);
        const pctOut=Math.round((d.totalOut/maxVal)*100);
        return(
          <div key={d.month} style={{...S.card,marginBottom:10,borderLeft:isCurrent?"3px solid #00B86B":"3px solid #EEF0F4"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:800,fontSize:14,color:isCurrent?"#00B86B":"#0D0D1A"}}>{MONTHS[m2-1]} {y2}{isCurrent?" ← atual":""}</span>
              <span style={{fontSize:13,fontWeight:800,color:d.balance>=0?"#00B86B":"#FF3D7F"}}>{fmt(d.balance)}</span>
            </div>
            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                <span style={{color:"#00B86B"}}>💰 {fmt(d.totalIn)}</span>
              </div>
              <ProgressBar pct={pctIn} color="#00B86B"/>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                <span style={{color:"#FF3D7F"}}>💸 {fmt(d.totalOut)}</span>
              </div>
              <ProgressBar pct={pctOut} color="#FF3D7F"/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// CATEGORIES
// ============================================================
function Categories({categories,expenses,incomes,onAdd,onEdit}){
  const [form,setForm]=useState(null);
  const [editItem,setEditItem]=useState(null);
  const [label,setLabel]=useState("");
  const [icon,setIcon]=useState("📌");
  const [color,setColor]=useState("#3B7BFF");
  const [type,setType]=useState("expense");

  const openEdit=(cat)=>{ setEditItem(cat);setLabel(cat.label);setIcon(cat.icon);setColor(cat.color);setType(cat.type);setForm("edit"); };
  const save=()=>{
    if(!label)return;
    const id=editItem?editItem.id:(label.toLowerCase().replace(/\s+/g,"_")+Date.now());
    const cat={id,label,icon,color,type};
    if(editItem) onEdit(cat); else onAdd(cat);
    setForm(null);setLabel("");setIcon("📌");setColor("#3B7BFF");setType("expense");setEditItem(null);
  };
  const expMap={},incMap={};
  expenses.forEach(e=>{ expMap[e.category]=(expMap[e.category]||0)+Number(e.amount); });
  incomes.forEach(i=>{ incMap[i.category]=(incMap[i.category]||0)+Number(i.amount); });

  return(
    <div style={{paddingBottom:80}}>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>🏷️ Categorias</h2>
        <button style={S.btnPrimary} onClick={()=>{setForm("new");setEditItem(null);setLabel("");setIcon("📌");setColor("#3B7BFF");setType("expense");}}>+ Nova</button>
      </div>
      {form && (
        <div style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontWeight:700,color:"#0D0D1A"}}>{form==="edit"?"Editar":"Nova"} categoria</span>
            <button style={{background:"none",border:"none",color:"#8A91A3",cursor:"pointer",fontSize:18}} onClick={()=>setForm(null)}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={{...S.input,flex:"0 0 55px",textAlign:"center",fontSize:22,padding:"6px"}} value={icon} onChange={e=>setIcon(e.target.value)}/>
            <input style={{...S.input,flex:1}} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Nome"/>
            <input style={{...S.input,flex:"0 0 42px",padding:4,height:42}} type="color" value={color} onChange={e=>setColor(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[{v:"income",l:"💰 Entrada"},{v:"expense",l:"💸 Gasto"},{v:"both",l:"↕️ Ambos"}].map(o=>(
              <button key={o.v} onClick={()=>setType(o.v)}
                style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${type===o.v?"#00B86B":"#EEF0F4"}`,background:type===o.v?"#00FF8822":"#0D0D1A",color:"#0D0D1A",cursor:"pointer",fontWeight:600,fontSize:12}}>
                {o.l}
              </button>
            ))}
          </div>
          <button style={S.btnPrimary} onClick={save}>{form==="edit"?"Atualizar":"Criar"} categoria</button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {categories.map(cat=>{
          const spent=expMap[cat.id]||0;
          const earned=incMap[cat.id]||0;
          return(
            <div key={cat.id} style={{...S.card,borderLeft:`3px solid ${cat.color}`,padding:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:22}}>{cat.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:12,color:"#0D0D1A"}}>{cat.label}</div>
                  <div style={{fontSize:10,color:"#9AA1B2",marginTop:2}}>{cat.type==="income"?"ENTRADA":cat.type==="expense"?"GASTO":"AMBOS"}</div>
                </div>
                <button style={{...S.btnIcon,fontSize:13}} onClick={()=>openEdit(cat)}>✏️</button>
              </div>
              {earned>0&&<div style={{fontSize:11,color:"#00B86B",fontWeight:600}}>+{fmt(earned)}</div>}
              {spent>0&&<div style={{fontSize:11,color:"#FF3D7F",fontWeight:600}}>-{fmt(spent)}</div>}
              {spent===0&&earned===0&&<div style={{fontSize:10,color:"#9AA1B2"}}>Sem movimentação</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ACCOUNT SETTINGS
// ============================================================
// ---- Open Finance (Pluggy) ----
const PLUGGY_WIDGET_URL = "https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js";
const OPEN_FINANCE_SANDBOX = true; // TODO go-live: trocar para false (esconde os bancos de teste)
const OPEN_FINANCE_ATIVO = true;  // liga (true) quando as credenciais da Pluggy estiverem validadas

function loadPluggyWidget(){
  return new Promise((resolve,reject)=>{
    if(window.PluggyConnect) return resolve(window.PluggyConnect);
    const s=document.createElement("script");
    s.src=PLUGGY_WIDGET_URL; s.async=true;
    s.onload=()=>resolve(window.PluggyConnect);
    s.onerror=()=>reject(new Error("Não consegui carregar o Open Finance agora."));
    document.body.appendChild(s);
  });
}

function OpenFinanceCard({accountData,user,fb,onUpgrade}){
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState(null); // {msg,type}
  const isPago = !!accountData?.plan && accountData.plan!=="explorador";

  const conectar=async()=>{
    if(!isPago){ onUpgrade&&onUpgrade(); return; }
    if(!fb||!user){ setStatus({msg:"App ainda carregando — tenta de novo em 1s.",type:"error"}); return; }
    setBusy(true); setStatus({msg:"Abrindo conexão segura…",type:"info"});
    try{
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js");
      const functions = getFunctions(fb.auth.app, "us-central1");
      const getToken = httpsCallable(functions, "pluggyConnectToken");
      const resp = await getToken({});
      const accessToken = resp.data.accessToken;

      const PluggyConnect = await loadPluggyWidget();
      const widget = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: OPEN_FINANCE_SANDBOX,
        onSuccess: async (itemData)=>{
          setStatus({msg:"Banco conectado! Importando seus lançamentos…",type:"info"});
          try{
            const sync = httpsCallable(functions, "pluggySync");
            const r = await sync({ itemId: itemData?.item?.id });
            setStatus({msg:`Prontinho! ${r.data?.importadas||0} lançamentos importados 🎉`,type:"success"});
          }catch(e){ setStatus({msg:"Conectou, mas falhou ao importar: "+e.message,type:"error"}); }
          setBusy(false);
        },
        onError: (err)=>{ setStatus({msg:"Erro ao conectar: "+(err?.message||"tenta de novo"),type:"error"}); setBusy(false); },
        onClose: ()=>{ setBusy(false); },
      });
      widget.init();
    }catch(e){
      if(String(e?.message||"").includes("OPEN_FINANCE_REQUER_PRO")){ onUpgrade&&onUpgrade(); }
      else setStatus({msg:e?.message||"Não deu pra abrir agora.",type:"error"});
      setBusy(false);
    }
  };

  return(
    <div style={{...S.card,marginBottom:14,border:"1px solid #00FF8833"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#0D0D1A"}}>🏦 Conectar meu banco</div>
          <div style={{fontSize:11,color:"#9AA1B2",marginTop:2,lineHeight:1.4}}>Open Finance: importa seus gastos automaticamente.{!OPEN_FINANCE_ATIVO?" Chega já já 🔜":(isPago?"":" Exclusivo dos planos Pro.")}</div>
        </div>
        <button disabled={busy||!OPEN_FINANCE_ATIVO} onClick={conectar} style={{background:!OPEN_FINANCE_ATIVO?"#EEF0F4":(isPago?"#00B86B":"#EEF0F4"),color:!OPEN_FINANCE_ATIVO?"#8A91A3":(isPago?"#04120a":"#8A91A3"),border:!OPEN_FINANCE_ATIVO?"1px solid #E7E9F0":(isPago?"none":"1px solid #E7E9F0"),borderRadius:10,padding:"10px 16px",fontWeight:800,fontSize:13,cursor:(busy||!OPEN_FINANCE_ATIVO)?"default":"pointer",whiteSpace:"nowrap"}}>
          {!OPEN_FINANCE_ATIVO?"Em breve 🔜":busy?"Conectando…":isPago?"Conectar 🔗":"Virar Pro ⚡"}
        </button>
      </div>
      {status && <div style={{marginTop:10,fontSize:12,color:status.type==="error"?"#FF3D7F":status.type==="success"?"#00B86B":"#8A91A3"}}>{status.msg}</div>}
    </div>
  );
}

function AccountSettings({accountData,user,fb,onSave,onUpgrade,isAdmin,onTab}){
  const [name,setName]=useState(accountData?.displayName||"");
  const [city,setCity]=useState(accountData?.city||"");
  const [state,setState]=useState(accountData?.state||"SP");
  const [newMember,setNewMember]=useState("");
  const [members,setMembers]=useState(accountData?.members||[]);
  const plan = PLANS[accountData?.plan||"explorador"];

  const addMember=()=>{
    if(!newMember||members.includes(newMember)) return;
    const updated=[...members,newMember];
    setMembers(updated);
    onSave({members:updated});
    setNewMember("");
  };
  const removeMember=(email)=>{
    if(email===accountData?.ownerEmail) return;
    const updated=members.filter(m=>m!==email);
    setMembers(updated);
    onSave({members:updated});
  };

  return(
    <div style={{paddingBottom:80}}>
      <h2 style={{...S.secTitle,marginBottom:14}}>👤 Meu Perfil</h2>

      {isAdmin && onTab && (
        <button onClick={()=>onTab("affiliates")} style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",marginBottom:14,border:"1px solid #00FF8844",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#E7F8EF)"}}>
          <span style={{fontWeight:700,fontSize:14,color:"#0D0D1A"}}>🎯 Programa de Afiliados</span>
          <span style={{color:"#00B86B",fontWeight:800}}>abrir →</span>
        </button>
      )}

      {/* Plano */}
      <div style={{...S.card,marginBottom:14,background:"#FFFFFF",border:"1px solid #00FF8833"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:"#8A91A3"}}>plano atual</div>
            <div style={{fontWeight:800,fontSize:16,color:"#00B86B",marginTop:2}}>{plan.name}</div>
            <div style={{fontSize:11,color:"#9AA1B2",marginTop:2}}>{plan.limit===Infinity?"lançamentos ilimitados":`${plan.limit} lançamentos/mês`}</div>
          </div>
          {accountData?.plan==="explorador" && (
            <button style={{background:"#00B86B",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:800,fontSize:13,color:"#0D0D1A",cursor:"pointer"}} onClick={onUpgrade}>
              Fazer upgrade ⚡
            </button>
          )}
        </div>
      </div>

      {/* Open Finance (Pluggy) */}
      <OpenFinanceCard accountData={accountData} user={user} fb={fb} onUpgrade={onUpgrade} />

      {/* Dados pessoais */}
      <div style={S.card}>
        <div style={{fontWeight:700,fontSize:13,color:"#0D0D1A",marginBottom:12}}>✏️ Dados pessoais</div>
        <div style={S.fg}><label style={S.label}>Como você quer ser chamado</label>
          <input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Yuri"/>
          <div style={{fontSize:10,color:"#9AA1B2",marginTop:3}}>É esse nome que aparece no “olá 👋” lá em cima</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{...S.fg,flex:2}}><label style={S.label}>Cidade</label>
            <input style={S.input} value={city} onChange={e=>setCity(e.target.value)}/>
          </div>
          <div style={{...S.fg,flex:1}}><label style={S.label}>Estado</label>
            <select style={S.input} value={state} onChange={e=>setState(e.target.value)}>
              {STATES_BR.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button style={S.btnPrimary} onClick={()=>onSave({displayName:name,city,state})}>Salvar</button>
      </div>

      {/* Membros da conta */}
      <div style={{...S.card,marginTop:14}}>
        <div style={{fontWeight:700,fontSize:13,color:"#0D0D1A",marginBottom:4}}>👥 Membros da conta</div>
        <div style={{fontSize:11,color:"#9AA1B2",marginBottom:12}}>Adicione o e-mail de quem vai usar a mesma conta (ex: cônjuge).</div>
        {members.map(email=>(
          <div key={email} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #EEF0F4"}}>
            <div>
              <div style={{fontSize:13,color:"#0D0D1A"}}>{email}</div>
              {email===accountData?.ownerEmail&&<div style={{fontSize:10,color:"#00B86B"}}>titular</div>}
            </div>
            {email!==accountData?.ownerEmail&&(
              <button style={{...S.btnIcon,color:"#FF3D7F"}} onClick={()=>removeMember(email)}>✕</button>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <input style={{...S.input,flex:1}} value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder="email@exemplo.com"/>
          <button style={{...S.btnPrimary,width:"auto",padding:"0 16px"}} onClick={addMember}>Adicionar</button>
        </div>
        <div style={{background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:10,padding:"10px 12px",marginTop:12,fontSize:11,color:"#8A91A3",lineHeight:1.5}}>
          🔑 <b style={{color:"#8A91A3"}}>Como a pessoa acessa:</b> depois de adicionada aqui, ela abre o app, clica em <b>“Criar conta grátis”</b> usando <b>esse mesmo e-mail</b> e escolhe a <b>senha dela</b>. Pronto — ela cai direto nesta conta compartilhada e vê os mesmos lançamentos. Cada um tem a própria senha; você não precisa saber a senha dela.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AFILIADOS (admin)
// ============================================================
function Affiliates({ fb, isDesktop, showToast }){
  const [affs,setAffs]=useState([]);
  const [accounts,setAccounts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(false);
  const [name,setName]=useState("");
  const [insta,setInsta]=useState("");
  const [code,setCode]=useState("");
  const [pct,setPct]=useState(20);
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    if(!fb) return;
    setLoading(true); setErr(false);
    try{
      const [aSnap,accSnap]=await Promise.all([
        fb.getDocs(fb.collection(fb.db,"affiliates")),
        fb.getDocs(fb.collection(fb.db,"accounts")),
      ]);
      setAffs(aSnap.docs.map(d=>({id:d.id,...d.data()})));
      setAccounts(accSnap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){ setErr(true); }
    setLoading(false);
  };
  useEffect(()=>{ load(); },[fb]);

  const suggestedCode=(name||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,10);
  const create=async()=>{
    const finalCode=((code||suggestedCode)||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!name.trim()){ showToast("Coloque o nome do influenciador","error"); return; }
    if(!finalCode){ showToast("Defina um código","error"); return; }
    if(!(Number(pct)>0&&Number(pct)<=100)){ showToast("Comissão entre 1 e 100%","error"); return; }
    setSaving(true);
    try{
      const exists=await fb.getDoc(fb.doc(fb.db,"affiliates",finalCode));
      if(exists.exists()){ showToast("Esse código já existe","error"); setSaving(false); return; }
      await fb.setDoc(fb.doc(fb.db,"affiliates",finalCode),{
        code:finalCode, name:name.trim(), instagram:insta.trim(), commissionPct:Number(pct),
        active:true, createdAt:Date.now(),
      });
      showToast("Afiliado criado ✅");
      setName(""); setInsta(""); setCode(""); setPct(20);
      load();
    }catch(e){ showToast("Erro ao criar (permissão do Firestore?)","error"); }
    setSaving(false);
  };

  const statsFor=(aff)=>{
    const ref=accounts.filter(a=>(a.referredBy||"").toUpperCase()===aff.code);
    const paying=ref.filter(a=>PLAN_MONTHLY[a.plan] && a.planStatus!=="cancelled");
    const monthly=paying.reduce((s,a)=>s+PLAN_MONTHLY[a.plan]*(aff.commissionPct/100),0);
    return { ref:ref.length, paying:paying.length, monthly };
  };
  const totalOwed=affs.reduce((s,a)=>s+statsFor(a).monthly,0);
  const totalPaying=affs.reduce((s,a)=>s+statsFor(a).paying,0);

  return (
    <div style={{paddingBottom:80}}>
      <h2 style={{...S.secTitle,marginBottom:6}}>🎯 Programa de Afiliados</h2>
      <p style={{fontSize:13,color:"#8A91A3",marginBottom:16}}>Crie um código pra cada influenciador. Quem se cadastrar com o código conta como indicação dele. Você paga a comissão manualmente todo mês, com base nos indicados que estão pagando.</p>

      <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:12,marginBottom:16}}>
        <div style={S.card}><div style={{fontSize:11,color:"#8A91A3"}}>Afiliados</div><div style={{fontWeight:900,fontSize:22,color:"#00B86B"}}>{affs.length}</div></div>
        <div style={S.card}><div style={{fontSize:11,color:"#8A91A3"}}>Indicados pagando</div><div style={{fontWeight:900,fontSize:22,color:"#E8930A"}}>{totalPaying}</div></div>
        <div style={S.card}><div style={{fontSize:11,color:"#8A91A3"}}>A pagar/mês</div><div style={{fontWeight:900,fontSize:22,color:"#FF3D7F"}}>{fmt(totalOwed)}</div></div>
      </div>

      <div style={{...S.card,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:"#0D0D1A",marginBottom:12}}>➕ Novo afiliado</div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr",gap:10}}>
          <div style={S.fg}><label style={S.label}>Nome do influenciador</label>
            <input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Maria Souza"/></div>
          <div style={S.fg}><label style={S.label}>@ do Instagram (opcional)</label>
            <input style={S.input} value={insta} onChange={e=>setInsta(e.target.value)} placeholder="@maria"/></div>
          <div style={S.fg}><label style={S.label}>Código do cupom</label>
            <input style={S.input} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder={suggestedCode||"Ex: MARIA10"}/></div>
          <div style={S.fg}><label style={S.label}>Comissão (%)</label>
            <input style={S.input} type="number" value={pct} onChange={e=>setPct(e.target.value)} placeholder="20"/></div>
        </div>
        <button style={{...S.btnPrimary,marginTop:6}} onClick={create} disabled={saving}>{saving?"Criando...":"Criar afiliado"}</button>
      </div>

      {loading && <p style={S.empty}>Carregando...</p>}
      {err && <p style={S.empty}>Não consegui carregar os dados (pode ser permissão do Firestore).</p>}
      {!loading && !err && affs.length===0 && <p style={S.empty}>Nenhum afiliado ainda. Crie o primeiro acima 👆</p>}
      {!loading && affs.map(aff=>{
        const st=statsFor(aff);
        const link=`https://app.meuigastei.com.br?ref=${aff.code}`;
        return (
          <div key={aff.id} style={{...S.card,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"#0D0D1A"}}>{aff.name} {aff.instagram&&<span style={{color:"#8A91A3",fontWeight:500,fontSize:12}}>{aff.instagram}</span>}</div>
                <div style={{fontSize:12,color:"#8A91A3",marginTop:2}}>Código: <b style={{color:"#00B86B"}}>{aff.code}</b> · Comissão: <b>{aff.commissionPct}%</b></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,fontSize:18,color:"#FF3D7F"}}>{fmt(st.monthly)}</div>
                <div style={{fontSize:11,color:"#9AA1B2"}}>a pagar/mês</div>
              </div>
            </div>
            <div style={{display:"flex",gap:16,marginTop:10,fontSize:12,color:"#8A91A3"}}>
              <span>👥 {st.ref} indicados</span>
              <span>💳 {st.paying} pagando</span>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
              <input readOnly value={link} style={{...S.input,flex:1,fontSize:12,color:"#8A91A3"}}/>
              <button style={{...S.btnSm,padding:"8px 12px",whiteSpace:"nowrap"}} onClick={()=>{ try{navigator.clipboard.writeText(link); showToast("Link copiado ✅");}catch(e){} }}>copiar link</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UpgradeScreen({ user, accountData, fb, onClose }) {
  const [loading, setLoading]   = useState(null); // "pro_mensal" | "pro_anual"

  const currentPlan = accountData?.plan || "explorador";

  const checkout = async (plan) => {
    if (!fb || !user) return;
    setLoading(plan);
    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js");
      const functions = getFunctions(fb.auth.app, "us-central1");
      const createCheckout = httpsCallable(functions, "createCheckoutSession");

      const origin = window.location.origin;
      const result = await createCheckout({
        plan,
        successUrl: `${origin}?upgrade=success`,
        cancelUrl:  `${origin}?upgrade=cancel`,
      });
      window.location.href = result.data.url;
    } catch (e) {
      console.error(e);
      alert("Erro ao abrir checkout: " + e.message);
    }
    setLoading(null);
  };

  const manageSubscription = async () => {
    if (!fb || !user) return;
    try {
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js");
      const functions = getFunctions(fb.auth.app, "us-central1");
      const createPortal = httpsCallable(functions, "createPortalSession");
      const result = await createPortal({ returnUrl: window.location.origin });
      window.location.href = result.data.url;
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const plans = [
    {
      id: "pro_mensal",
      name: "Pro Mensal",
      icon: "🚀",
      price: "19,90",
      originalPrice: null,
      period: "/mês",
      features: ["Lançamentos ilimitados", "Até 4 pessoas na conta", "Comparativo de meses", "Relatório PDF", "Suporte prioritário"],
      color: "#00B86B",
      featured: false,
    },
    {
      id: "pro_anual",
      name: "Pro Anual",
      icon: "💎",
      price: "118,80",
      originalPrice: null,
      period: "/ano",
      sub: "equivale a R$9,90/mês",
      features: ["Tudo do Pro Mensal", "Histórico completo", "Economize 50%", "Prioridade máxima"],
      color: "#E8930A",
      featured: true,
    },
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto",border:"1px solid #EEF0F4"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontWeight:900,fontSize:20,color:"#0D0D1A"}}>⚡ Fazer upgrade</div>
            <div style={{fontSize:12,color:"#8A91A3",marginTop:2}}>Desbloqueie tudo no iGastei</div>
          </div>
          <button style={{background:"none",border:"none",color:"#8A91A3",fontSize:22,cursor:"pointer"}} onClick={onClose}>✕</button>
        </div>

        {/* Gerenciar assinatura (se já for pro) */}
        {currentPlan !== "explorador" && currentPlan !== "influencer" && (
          <div style={{background:"#00FF8815",border:"1px solid #00FF8833",borderRadius:12,padding:14,marginBottom:16}}>
            <div style={{fontSize:13,color:"#00B86B",fontWeight:700,marginBottom:4}}>✅ Você já tem o plano {currentPlan === "pro_mensal" ? "Pro Mensal" : "Pro Anual"}</div>
            <div style={{fontSize:12,color:"#8A91A3",marginBottom:10}}>Gerencie sua assinatura, veja faturas ou cancele quando quiser.</div>
            <button style={{background:"#EEF0F4",border:"1px solid #9AA1B2",color:"#0D0D1A",borderRadius:10,padding:"10px 16px",cursor:"pointer",fontWeight:700,fontSize:13,width:"100%"}}
              onClick={manageSubscription}>
              Gerenciar assinatura →
            </button>
          </div>
        )}

        {/* Planos */}
        {(currentPlan === "explorador" || currentPlan === "influencer") && (
          <>
            {plans.map(p => (
              <div key={p.id} style={{background:"#ECEEF2",border:`2px solid ${p.featured ? p.color+"44" : "#EEF0F4"}`,borderRadius:14,padding:16,marginBottom:12,position:"relative"}}>
                {p.featured && (
                  <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:`${p.color}`,color:"#0D0D1A",borderRadius:20,padding:"3px 14px",fontSize:10,fontWeight:900,whiteSpace:"nowrap"}}>
                    ⭐ Mais econômico
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:"#0D0D1A"}}>{p.icon} {p.name}</div>
                    {p.sub && <div style={{fontSize:10,color:"#8A91A3",marginTop:2}}>{p.sub}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    {p.originalPrice && <div style={{fontSize:11,color:"#9AA1B2",textDecoration:"line-through"}}>R${p.originalPrice}</div>}
                    <div style={{fontWeight:900,fontSize:22,color:p.color}}>R${p.price}</div>
                    <div style={{fontSize:10,color:"#8A91A3"}}>{p.period}</div>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  {p.features.map(f => (
                    <div key={f} style={{fontSize:12,color:"#8A91A3",padding:"4px 0",display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{color:p.color,fontWeight:700}}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <button
                  style={{width:"100%",background:`${p.color}`,border:"none",borderRadius:12,padding:"13px",fontWeight:900,fontSize:14,color:"#0D0D1A",cursor:"pointer",opacity:loading?0.7:1}}
                  onClick={()=>checkout(p.id)}
                  disabled={!!loading}>
                  {loading===p.id ? "Abrindo checkout..." : `Assinar ${p.name} →`}
                </button>
              </div>
            ))}
          </>
        )}

        {/* Segurança */}
        <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:16,flexWrap:"wrap"}}>
          {["🔒 Pagamento seguro","↩️ Cancele quando quiser","🇧🇷 Suporte em português"].map(t=>(
            <div key={t} style={{fontSize:10,color:"#9AA1B2"}}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PÁGINA DE SUCESSO (detecta ?upgrade=success na URL)
// ============================================================
function UpgradeSuccess({ onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:20,padding:32,maxWidth:340,width:"100%",textAlign:"center",border:"1px solid #00FF8833"}}>
        <div style={{fontSize:60,marginBottom:16}}>🎉</div>
        <div style={{fontWeight:900,fontSize:22,color:"#00B86B",marginBottom:8}}>Bem-vindo ao Pro!</div>
        <div style={{fontSize:14,color:"#8A91A3",marginBottom:24,lineHeight:1.6}}>Seu plano foi ativado. Agora você tem acesso completo ao iGastei sem limites!</div>
        <button style={{background:"#00B86B",border:"none",borderRadius:12,padding:"13px 24px",fontWeight:900,fontSize:14,color:"#0D0D1A",cursor:"pointer",width:"100%"}} onClick={onClose}>
          Usar o iGastei →
        </button>
      </div>
    </div>
  );
}


// ============================================================
// STYLES
// ============================================================
const S={
  root:{minHeight:"100vh",background:"#ECEEF2",color:"#0D0D1A",fontFamily:"'Inter',system-ui,sans-serif",paddingBottom:94},
  rootDesktop:{minHeight:"100vh",background:"#ECEEF2",color:"#0D0D1A",fontFamily:"'Inter',system-ui,sans-serif",display:"flex"},
  sidebar:{width:250,flexShrink:0,background:"#FFFFFF",borderRight:"1px solid #E7E9F0",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"},
  sideItem:{display:"flex",alignItems:"center",gap:12,width:"100%",background:"none",border:"none",color:"#555c6b",padding:"12px 14px",borderRadius:12,cursor:"pointer",fontSize:14.5,fontWeight:700,textAlign:"left",fontFamily:"inherit",transition:"background .15s,color .15s"},
  sideItemOn:{background:"#E7F8EF",color:"#047A46",fontWeight:800},
  dMain:{flex:1,minWidth:0,display:"flex",flexDirection:"column"},
  topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 34px",borderBottom:"1px solid #E7E9F0",position:"sticky",top:0,background:"#ECEEF2",zIndex:10},
  dContent:{padding:"26px 34px 60px",maxWidth:1160,width:"100%",margin:"0 auto"},
  header:{background:"#ECEEF2",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10},
  avatar:{width:44,height:44,background:"#00B86B",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#fff",flexShrink:0},
  monthSel:{display:"flex",alignItems:"center",gap:2,background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:12,padding:"3px 4px"},
  monthBtn:{background:"transparent",border:"none",color:"#555c6b",borderRadius:9,width:34,height:34,cursor:"pointer",fontSize:18,fontWeight:900},
  btnLogout:{background:"#FFFFFF",border:"1px solid #E7E9F0",color:"#8A91A3",borderRadius:10,padding:"9px 12px",cursor:"pointer",fontSize:12.5,fontWeight:800},
  toast:{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",padding:"12px 20px",borderRadius:12,fontWeight:800,zIndex:999,fontSize:13,whiteSpace:"nowrap",boxShadow:"0 10px 34px rgba(13,13,26,.18)"},
  loginRoot:{minHeight:"100vh",background:"#ECEEF2",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  loginCard:{background:"#FFFFFF",borderRadius:24,padding:28,width:"100%",maxWidth:380,border:"1px solid #E7E9F0",boxShadow:"0 30px 60px rgba(13,13,26,.08)"},
  main:{padding:"8px 16px 16px",maxWidth:520,margin:"0 auto"},
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#FFFFFF",borderTop:"1px solid #E7E9F0",display:"flex",alignItems:"center",zIndex:10,height:72,padding:"0 8px"},
  bottomNavBtn:{flex:1,background:"none",border:"none",color:"#8A91A3",padding:"8px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,fontWeight:800},
  bottomNavBtnOn:{color:"#0D0D1A"},
  bottomNavCenter:{width:54,height:54,background:"#00B86B",border:"none",borderRadius:17,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",flexShrink:0,margin:"0 8px"},
  fg:{marginBottom:12},
  label:{display:"block",fontSize:11,color:"#8A91A3",marginBottom:6,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase"},
  input:{width:"100%",background:"#FFFFFF",border:"1px solid #E7E9F0",borderRadius:12,padding:"13px 14px",color:"#0D0D1A",fontSize:15,boxSizing:"border-box",outline:"none",fontFamily:"inherit"},
  btnPrimary:{background:"#00B86B",border:"none",color:"#fff",borderRadius:13,padding:"14px 20px",cursor:"pointer",fontWeight:800,fontSize:15,width:"100%",minHeight:50},
  btnGhost:{width:"100%",background:"#FFFFFF",border:"1px solid #E7E9F0",color:"#555c6b",borderRadius:13,padding:14,cursor:"pointer",fontWeight:700,fontSize:15},
  btnLink:{background:"none",border:"none",color:"#047A46",cursor:"pointer",fontSize:14,width:"100%",marginTop:8,padding:8,textAlign:"center",fontWeight:700},
  btnSm:{background:"#F1F3F7",border:"none",color:"#555c6b",borderRadius:10,padding:"8px 13px",cursor:"pointer",fontWeight:800,fontSize:12.5},
  btnIcon:{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4,opacity:.6},
  card:{background:"#FFFFFF",borderRadius:20,padding:18,border:"1px solid #E7E9F0"},
  secHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  secTitle:{fontWeight:900,fontSize:22,color:"#0D0D1A",margin:0,letterSpacing:"-0.02em"},
  listItem:{background:"#FFFFFF",borderRadius:16,padding:"13px 15px",marginBottom:9,display:"flex",alignItems:"center",gap:10,border:"1px solid #E7E9F0"},
  listIcon:{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:"#F1F3F7"},
  chip:{background:"#F1F3F7",border:"none",color:"#8A91A3",borderRadius:20,padding:"7px 13px",cursor:"pointer",fontSize:12.5,fontWeight:700},
  chipOn:{background:"#E7F8EF",color:"#047A46"},
  empty:{color:"#AAB0BF",textAlign:"center",padding:32,fontSize:14},
  overlay:{position:"fixed",inset:0,background:"rgba(13,13,26,.4)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{background:"#FFFFFF",borderRadius:"24px 24px 0 0",padding:20,width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto",border:"1px solid #E7E9F0"},
};
