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
  { id: "moradia",     label: "Moradia",         icon: "🏠", color: "#6366f1", type: "expense" },
  { id: "alimentacao", label: "Alimentação",      icon: "🛒", color: "#f59e0b", type: "expense" },
  { id: "transporte",  label: "Transporte",       icon: "🚗", color: "#3b82f6", type: "expense" },
  { id: "saude",       label: "Saúde",            icon: "💊", color: "#10b981", type: "expense" },
  { id: "lazer",       label: "Lazer",            icon: "🎉", color: "#ec4899", type: "expense" },
  { id: "educacao",    label: "Educação",         icon: "📚", color: "#8b5cf6", type: "expense" },
  { id: "vestuario",   label: "Vestuário",        icon: "👗", color: "#f97316", type: "expense" },
  { id: "pessoal",     label: "Gastos Pessoais",  icon: "👤", color: "#14b8a6", type: "expense" },
  { id: "dividas",     label: "Dívidas/Parcelas", icon: "💳", color: "#ef4444", type: "expense" },
  { id: "salario",     label: "Salário",          icon: "💼", color: "#00FF88", type: "income"  },
  { id: "freela",      label: "Freelance/Extra",  icon: "💡", color: "#06b6d4", type: "income"  },
  { id: "outros",      label: "Outros",           icon: "📦", color: "#94a3b8", type: "both"    },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const todayStr = () => { const d=new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
const monthKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
// Nome legível de categoria: remove sufixo técnico "_1783870137705" e deixa bonito
const prettyCat = (cid) => String(cid||"").replace(/[_-]?\d{9,}$/,"").replace(/[_-]+/g," ").trim().replace(/^\w/, c=>c.toUpperCase()) || "Outros";
// Resolve categoria: acha na lista ou cria um fallback limpo (nome sem números)
const catOf = (categories, id, icon="📦", color="#94a3b8") => categories.find(c=>c.id===id) || { id, label:prettyCat(id), icon, color };

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
  const [isDesktop, setIsDesktop] = useState(typeof window!=="undefined" ? window.innerWidth>=1000 : false);

  useEffect(()=>{
    const onResize=()=>setIsDesktop(window.innerWidth>=1000);
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
    const { collection, query, where, onSnapshot, doc, getDoc, db } = fb;

    // Dados são filtrados por accountId para que membros vejam o mesmo
    const u1 = onSnapshot(
      query(collection(db,"incomes"), where("month","==",month)),
      s => setIncomes(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.accountId===accountId))
    );
    const u2 = onSnapshot(
      query(collection(db,"expenses"), where("month","==",month)),
      s => setExpenses(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.accountId===accountId))
    );
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
    const item = { ...data, accountId, userId: user?.uid||"demo", userName: user?.displayName||user?.email||"Demo", month, createdAt: Date.now() };
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

  const totalIn  = incomes.reduce((s,i)=>s+Number(i.amount),0);
  const totalOut = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const balance  = totalIn - totalOut;
  const planInfo = PLANS[accountData?.plan || "explorador"];
  const isAdmin = !demo && isAdminEmail(user?.email);
  const totalLancamentos = incomes.length + expenses.length;
  const planUsagePct = planInfo.limit === Infinity ? 0 : Math.round((totalLancamentos/planInfo.limit)*100);

  if (screen==="login") return (
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
  );

  const content = (
    <>
      {tab==="dashboard"  && <Dashboard incomes={incomes} expenses={expenses} categories={categories} totalIn={totalIn} totalOut={totalOut} balance={balance} goal={goal} month={month} onGoal={saveGoal} histData={histData} onTab={setTab} planInfo={planInfo} totalLancamentos={totalLancamentos} onUpgrade={()=>setShowUpgrade(true)} isDesktop={isDesktop} />}
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
      {toast && <div style={{...S.toast, background: toast.type==="error"?"#FF3D7F":toast.type==="info"?"#6366f1":"#00FF88", color: toast.type==="success"?"#0D0D1A":"#fff"}}>{toast.msg}</div>}
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
        <div style={{fontWeight:900,fontSize:23,letterSpacing:"-.5px"}}>💸 <span style={{background:"linear-gradient(135deg,#00FF88,#FFD60A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>iGastei</span></div>
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
        <div style={{margin:"0 14px 12px",background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid #00FF8833",borderRadius:12,padding:14}}>
          <div style={{fontSize:12,color:"#00FF88",fontWeight:800}}>🎮 Modo Explorador</div>
          <div style={{fontSize:11,color:"#6b7280",margin:"3px 0 8px"}}>{totalLancamentos}/10 lançamentos</div>
          <button style={{width:"100%",background:"linear-gradient(135deg,#00FF88,#FFD60A)",border:"none",borderRadius:8,padding:"8px",fontWeight:800,fontSize:12,color:"#0D0D1A",cursor:"pointer"}} onClick={onUpgrade}>Fazer upgrade ⚡</button>
        </div>
      )}
      <div style={{borderTop:"1px solid #1e2035",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#00FF88,#FFD60A)",flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{firstName}</div>
          <div style={{fontSize:10,color:"#475569"}}>{demo?"Demo":planInfo?.name}</div>
        </div>
        <button style={{background:"none",border:"1px solid #1e2035",borderRadius:8,color:"#94a3b8",fontSize:12,padding:"6px 10px",cursor:"pointer"}} onClick={onLogout}>Sair</button>
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
        <div style={{fontSize:12,color:"#6b7280"}}>olá,</div>
        <div style={{fontWeight:800,fontSize:18,color:"#e2e8f0"}}>{firstName} 👋</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1e2035",borderRadius:10,padding:"6px 8px"}}>
          <button style={S.monthBtn} onClick={prev}>‹</button>
          <span style={{fontWeight:700,fontSize:14,minWidth:96,textAlign:"center"}}>{MONTHS[m-1]} {y}</span>
          <button style={S.monthBtn} onClick={next}>›</button>
        </div>
        {planInfo?.limit===Infinity && <span style={{fontSize:12,fontWeight:800,color:"#0D0D1A",background:"linear-gradient(135deg,#00FF88,#FFD60A)",padding:"6px 12px",borderRadius:100}}>{planInfo.name}</span>}
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
      {toast && <div style={{...S.toast,background:toast.type==="error"?"#FF3D7F":"#00FF88",color:toast.type==="success"?"#0D0D1A":"#fff"}}>{toast.msg}</div>}
      <div style={S.loginCard}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:4}}>💸</div>
          <div style={{fontWeight:900,fontSize:28,background:"linear-gradient(135deg,#00FF88,#FFD60A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-1px"}}>iGastei</div>
          <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>{reg?"Cria sua conta grátis":"Bem-vindo de volta"}</div>
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
          <button style={{...S.btnLink,color:"#6b7280",fontSize:13,marginTop:2}} onClick={()=>onForgot(email)} disabled={loading}>
            Esqueci minha senha
          </button>
        )}

        {reg && (
          <div style={{background:"#1a1a2e",borderRadius:10,padding:12,marginTop:8}}>
            <div style={{fontSize:12,color:"#00FF88",fontWeight:700,marginBottom:4}}>🎮 Modo Explorador (grátis)</div>
            <div style={{fontSize:11,color:"#6b7280"}}>10 lançamentos/mês pra você sentir o app. Depois é só fazer upgrade!</div>
          </div>
        )}

        <div style={{textAlign:"center",color:"#334155",margin:"16px 0",borderTop:"1px solid #1e2035",lineHeight:0}}>
          <span style={{background:"#0D0D1A",padding:"0 12px",color:"#475569",fontSize:12}}>ou</span>
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
  const isExplorador = accountData?.plan === "explorador";

  return(
    <header style={S.header}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={S.avatar}>{firstName[0]?.toUpperCase()}</div>
        <div>
          <div style={{fontSize:11,color:"#6b7280"}}>olá,</div>
          <div style={{fontWeight:800,fontSize:15,color:"#e2e8f0"}}>{firstName} 👋</div>
        </div>
        {demo && <div style={{fontSize:10,background:"#FFD60A",color:"#0D0D1A",borderRadius:4,padding:"2px 8px",fontWeight:800}}>DEMO</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {isExplorador && (
          <div style={{fontSize:10,background:"#1a1a2e",borderRadius:6,padding:"3px 8px",color:"#00FF88",fontWeight:700}}>
            {totalLancamentos}/10 lançamentos
          </div>
        )}
        <div style={S.monthSel}>
          <button style={S.monthBtn} onClick={prev}>‹</button>
          <span style={{fontSize:12,fontWeight:700,minWidth:68,textAlign:"center",color:"#e2e8f0"}}>{MONTHS[m-1]} {y}</span>
          <button style={S.monthBtn} onClick={next}>›</button>
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
function Dashboard({incomes,expenses,categories,totalIn,totalOut,balance,goal,month,onGoal,histData,onTab,planInfo,totalLancamentos,onUpgrade,isDesktop}){
  const [editGoal,setEditGoal]=useState(false);
  const [gInput,setGInput]=useState(goal);
  const saved=balance;
  const goalPct=goal>0?Math.min(100,Math.round((saved/goal)*100)):0;
  const isExplorador = planInfo?.limit !== Infinity;
  const bigNum = isDesktop?24:20;

  const byCatExp={};
  expenses.forEach(e=>{ byCatExp[e.category]=(byCatExp[e.category]||0)+Number(e.amount); });

  const byPerson={};
  incomes.forEach(i=>{ const k=i.userName||"—"; if(!byPerson[k]) byPerson[k]={in:0,out:0}; byPerson[k].in+=Number(i.amount); });
  expenses.forEach(e=>{ const k=e.userName||"—"; if(!byPerson[k]) byPerson[k]={in:0,out:0}; byPerson[k].out+=Number(e.amount); });

  const banner = isExplorador && (
    <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid #00FF8833",borderRadius:12,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:12,color:"#00FF88",fontWeight:800}}>🎮 Modo Explorador</div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{totalLancamentos}/10 lançamentos este mês</div>
        </div>
        <button style={{background:"linear-gradient(135deg,#00FF88,#FFD60A)",border:"none",borderRadius:8,padding:"6px 12px",fontWeight:800,fontSize:12,color:"#0D0D1A",cursor:"pointer"}} onClick={onUpgrade}>Fazer upgrade ⚡</button>
      </div>
      <div style={{marginTop:8,height:4,background:"#0D0D1A",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(totalLancamentos/10)*100}%`,background:"linear-gradient(90deg,#00FF88,#FFD60A)",borderRadius:2,transition:"width .5s"}}/>
      </div>
    </div>
  );

  const statEntradas = (
    <div style={{...S.card,borderTop:"2px solid #00FF88"}}>
      <div style={{fontSize:11,color:"#6b7280",fontWeight:600}}>💰 Entradas</div>
      <div style={{fontWeight:900,fontSize:bigNum,color:"#00FF88",marginTop:4}}>{fmt(totalIn)}</div>
      <div style={{fontSize:10,color:"#475569"}}>{incomes.length} lançamentos</div>
    </div>
  );
  const statGastos = (
    <div style={{...S.card,borderTop:"2px solid #FF3D7F"}}>
      <div style={{fontSize:11,color:"#6b7280",fontWeight:600}}>💸 Gastos</div>
      <div style={{fontWeight:900,fontSize:bigNum,color:"#FF3D7F",marginTop:4}}>{fmt(totalOut)}</div>
      <div style={{fontSize:10,color:"#475569"}}>{expenses.length} lançamentos</div>
    </div>
  );
  const statSaldo = (
    <div style={{...S.card,background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:`1px solid ${balance>=0?"#00FF8833":"#FF3D7F33"}`,textAlign:isDesktop?"left":"center",padding:isDesktop?16:20,borderTop:isDesktop?"2px solid #FFD60A":undefined}}>
      <div style={{fontSize:isDesktop?11:12,color:"#6b7280",fontWeight:600}}>{isDesktop?"💵 Saldo atual":"saldo atual"}</div>
      <div style={{fontWeight:900,fontSize:isDesktop?bigNum:32,color:balance>=0?"#00FF88":"#FF3D7F",letterSpacing:"-1px",marginTop:4}}>{fmt(balance)}</div>
      <div style={{fontSize:isDesktop?10:11,color:balance>=0?"#00FF8888":"#FF3D7F88",marginTop:4}}>{balance>=0?"✅ tudo certo!":"⚠️ gastos > entradas"}</div>
    </div>
  );

  const metaCard = (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>🎯 Meta de economia</span>
        <button style={S.btnSm} onClick={()=>{setEditGoal(!editGoal);setGInput(goal);}}>{editGoal?"cancelar":"editar"}</button>
      </div>
      {editGoal?(
        <div style={{display:"flex",gap:8}}>
          <input style={{...S.input,flex:1}} type="number" value={gInput} onChange={e=>setGInput(Number(e.target.value))} placeholder="Ex: 2000"/>
          <button style={{...S.btnPrimary,width:"auto",padding:"0 16px"}} onClick={()=>{onGoal(gInput);setEditGoal(false);}}>salvar</button>
        </div>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
            <span style={{color:"#00FF88",fontWeight:700}}>{fmt(saved)} economizados</span>
            <span style={{color:"#475569"}}>meta: {fmt(goal)}</span>
          </div>
          <ProgressBar pct={goalPct} color={goalPct>=100?"#00FF88":"#FFD60A"}/>
          <div style={{textAlign:"right",fontSize:11,color:"#475569",marginTop:3}}>{goalPct}%</div>
        </>
      )}
    </div>
  );

  const porPessoaCard = Object.keys(byPerson).length>0 && (
    <div style={S.card}>
      <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",marginBottom:12}}>👥 Por pessoa</div>
      {Object.entries(byPerson).map(([name,v])=>(
        <div key={name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:14}}>{name[0]?.toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,color:"#e2e8f0"}}>{name}</div>
            <div style={{display:"flex",gap:10,fontSize:11,marginTop:2}}>
              <span style={{color:"#00FF88"}}>+{fmt(v.in)}</span>
              <span style={{color:"#FF3D7F"}}>-{fmt(v.out)}</span>
              <span style={{color:v.in-v.out>=0?"#FFD60A":"#FF3D7F",fontWeight:700}}>=&nbsp;{fmt(v.in-v.out)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const categoriaCard = Object.keys(byCatExp).length>0 && (
    <div style={S.card}>
      <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",marginBottom:12}}>🏷️ Gastos por categoria</div>
      {Object.entries(byCatExp).sort((a,b)=>b[1]-a[1]).slice(0,isDesktop?8:5).map(([cid,val])=>{
        const cat=categories.find(c=>c.id===cid)||{label:prettyCat(cid),icon:"📦",color:"#94a3b8"};
        const pct=totalOut>0?(val/totalOut)*100:0;
        return(
          <div key={cid} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{cat.icon} {cat.label}</span>
              <span style={{fontWeight:700,fontSize:12,color:cat.color}}>{fmt(val)}</span>
            </div>
            <ProgressBar pct={pct} color={cat.color}/>
          </div>
        );
      })}
    </div>
  );

  const comparativoCard = histData&&histData.length>0 && (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>📈 Comparativo</span>
        <button style={S.btnSm} onClick={()=>onTab("comparativo")}>ver tudo →</button>
      </div>
      <div style={{display:"flex",gap:isDesktop?8:4,alignItems:"flex-end",height:isDesktop?110:60}}>
        {histData.map((d)=>{
          const [,m2]=d.month.split("-").map(Number);
          const maxVal=Math.max(...histData.map(x=>Math.max(x.totalIn,x.totalOut)),1);
          const hOut=Math.round((d.totalOut/maxVal)*100);
          const isCurrent=d.month===month;
          return(
            <div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:"100%",height:isDesktop?96:50,display:"flex",alignItems:"flex-end"}}>
                <div style={{width:"100%",height:`${hOut}%`,background:isCurrent?"linear-gradient(180deg,#FF3D7F,#ff6b9d)":"#1e2035",borderRadius:"3px 3px 0 0",minHeight:3}}/>
              </div>
              <span style={{fontSize:9,color:isCurrent?"#00FF88":"#475569",fontWeight:isCurrent?800:400}}>{MONTHS[m2-1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isDesktop) return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {banner}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>{statEntradas}{statGastos}{statSaldo}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>{metaCard}{porPessoaCard}</div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>{categoriaCard}{comparativoCard}</div>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,paddingBottom:16}}>
      {banner}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{statEntradas}{statGastos}</div>
      {statSaldo}
      {metaCard}
      {porPessoaCard}
      {categoriaCard}
      {comparativoCard}
    </div>
  );
}

function ProgressBar({pct,color}){
  return <div style={{height:6,background:"#1e2035",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .5s"}}/></div>;
}

// ============================================================
// ITEM FORM
// ============================================================
function ItemForm({type,categories,item,onSave,onClose,onAddCat}){
  const isIncome=type==="income";
  const validCats=categories.filter(c=>c.type===type||c.type==="both");
  const [desc,setDesc]=useState(item?.description||"");
  const [amt,setAmt]=useState(item?.amount||"");
  const [cat,setCat]=useState(item?.category||(validCats[0]?.id||"outros"));
  const [date,setDate]=useState(item?.date||todayStr());
  const [newCat,setNewCat]=useState(false);
  const [ncLabel,setNcLabel]=useState("");
  const [ncIcon,setNcIcon]=useState(isIncome?"💡":"📌");
  const [ncColor,setNcColor]=useState(isIncome?"#00FF88":"#6366f1");

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
          <h3 style={{color:"#e2e8f0",fontWeight:800,fontSize:16,margin:0}}>{item?"Editar":"Nova"} {isIncome?"entrada":"despesa"}</h3>
          <button style={{background:"none",border:"none",color:"#6b7280",fontSize:20,cursor:"pointer"}} onClick={onClose}>✕</button>
        </div>

        <div style={S.fg}><label style={S.label}>Descrição</label>
          <input style={S.input} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={isIncome?"Ex: Salário":"Ex: Aluguel"}/>
        </div>

        <div style={{display:"flex",gap:10}}>
          <div style={{...S.fg,flex:1}}><label style={S.label}>Valor (R$)</label>
            <input style={S.input} type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0,00"/>
          </div>
          <div style={{...S.fg,flex:1}}><label style={S.label}>Data</label>
            <input style={S.input} value={date} onChange={e=>setDate(e.target.value)} placeholder="DD/MM/AAAA"/>
          </div>
        </div>

        <div style={S.fg}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={S.label}>Categoria</label>
            <button style={S.btnSm} onClick={()=>setNewCat(!newCat)}>{newCat?"cancelar":"+ nova"}</button>
          </div>
          {newCat?(
            <div style={{background:"#0D0D1A",borderRadius:10,padding:12,marginBottom:8}}>
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
                  style={{background:cat===c.id?c.color+"22":"#0D0D1A",border:`2px solid ${cat===c.id?c.color:"#1e2035"}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:"#e2e8f0",fontSize:12,fontWeight:600,transition:"all .15s"}}>
                  <span style={{fontSize:18}}>{c.icon}</span>
                  <span style={{flex:1,textAlign:"left",fontSize:11}}>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button style={{...S.btnPrimary,background:isIncome?"linear-gradient(135deg,#00FF88,#06b6d4)":"linear-gradient(135deg,#FF3D7F,#f97316)",color:isIncome?"#0D0D1A":"#fff",marginTop:8}}
          onClick={()=>{ if(!desc||!amt)return; onSave({description:desc,amount:Number(amt),category:cat,date}); }}>
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
  const activeCats=[...new Set(incomes.map(i=>i.category))].map(id=>catOf(categories,id,"💼","#00FF88"));
  const totalAll=incomes.reduce((s,i)=>s+Number(i.amount),0);
  const totalFiltered=filtered.reduce((s,i)=>s+Number(i.amount),0);
  const filterCat=filter!=="all"?catOf(categories,filter,"💼","#00FF88"):null;

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
          <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>💰 Total do mês</span>
          <span style={{fontWeight:900,fontSize:16,color:"#00FF88"}}>+{fmt(totalAll)}</span>
        </div>
      )}
      {filter!=="all" && filterCat && (
        <div style={{...S.card,marginBottom:10,borderLeft:`3px solid ${filterCat.color}`,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#6b7280",fontWeight:600}}>{filterCat.icon} {filterCat.label}</div>
              <div style={{fontSize:11,color:"#475569",marginTop:2}}>{filtered.length} lançamento{filtered.length!==1?"s":""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:17,color:"#00FF88"}}>+{fmt(totalFiltered)}</div>
              <div style={{fontSize:11,color:"#475569"}}>{totalAll>0?((totalFiltered/totalAll)*100).toFixed(1):0}% do total</div>
            </div>
          </div>
        </div>
      )}

      {filtered.length===0 && <p style={S.empty}>Nenhuma entrada {filter!=="all"?"nesta categoria":"este mês"}</p>}
      {[...filtered].sort((a,b)=>b.createdAt-a.createdAt).map(inc=>{
        const cat=categories.find(c=>c.id===inc.category)||{icon:"💼",color:"#00FF88",label:prettyCat(inc.category)};
        return(
          <div key={inc.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22"}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"#e2e8f0"}}>{inc.description}</div>
              <div style={{fontSize:11,color:"#475569"}}>{inc.date} · {inc.userName} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#00FF88"}}>+{fmt(inc.amount)}</div>
            <div style={{display:"flex",gap:2}}>
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
        <button style={{...S.btnPrimary,background:"linear-gradient(135deg,#FF3D7F,#f97316)",color:"#fff"}} onClick={()=>setForm("new")}>+ Adicionar</button>
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
          <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>💸 Total do mês</span>
          <span style={{fontWeight:900,fontSize:16,color:"#FF3D7F"}}>-{fmt(totalAll)}</span>
        </div>
      )}
      {filter!=="all" && filterCat && (
        <div style={{...S.card,marginBottom:10,borderLeft:`3px solid ${filterCat.color}`,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#6b7280",fontWeight:600}}>{filterCat.icon} {filterCat.label}</div>
              <div style={{fontSize:11,color:"#475569",marginTop:2}}>{filtered.length} lançamento{filtered.length!==1?"s":""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:17,color:"#FF3D7F"}}>-{fmt(totalFiltered)}</div>
              <div style={{fontSize:11,color:"#475569"}}>{totalAll>0?((totalFiltered/totalAll)*100).toFixed(1):0}% do total</div>
            </div>
          </div>
        </div>
      )}

      {filtered.length===0 && <p style={S.empty}>Nenhum gasto {filter!=="all"?"nesta categoria":"este mês"}</p>}
      {[...filtered].sort((a,b)=>b.createdAt-a.createdAt).map(exp=>{
        const cat=categories.find(c=>c.id===exp.category)||{icon:"📦",color:"#94a3b8",label:prettyCat(exp.category)};
        return(
          <div key={exp.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22"}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"#e2e8f0"}}>{exp.description}</div>
              <div style={{fontSize:11,color:"#475569"}}>{exp.date} · {exp.userName} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#FF3D7F"}}>-{fmt(exp.amount)}</div>
            <div style={{display:"flex",gap:2}}>
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
    const incRows=incomes.map(i=>{ const cat=categories.find(c=>c.id===i.category)||{label:prettyCat(i.category),icon:"💰"}; return `<tr><td>${i.date}</td><td>${i.description}</td><td>${i.userName||"—"}</td><td>${cat.icon} ${cat.label}</td><td style="color:#00FF88;text-align:right">+${fmt(i.amount)}</td></tr>`; }).join("");
    const expRows=expenses.map(e=>{ const cat=categories.find(c=>c.id===e.category)||{label:prettyCat(e.category),icon:"📦"}; return `<tr><td>${e.date}</td><td>${e.description}</td><td>${e.userName||"—"}</td><td>${cat.icon} ${cat.label}</td><td style="color:#FF3D7F;text-align:right">-${fmt(e.amount)}</td></tr>`; }).join("");
    const saved=totalIn-totalOut;
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>iGastei – ${monthLabel}</title><style>*{box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;max-width:800px;margin:0 auto;background:#f8fafc;}h1{color:#0D0D1A;font-size:26px;}h2{color:#6366f1;font-size:16px;margin:24px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px;}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0;}.card{border-radius:10px;padding:14px;text-align:center;}.g{background:#dcfce7;}.r{background:#fee2e2;}.b{background:#ede9fe;}.val{font-size:18px;font-weight:900;margin:4px 0;}.lbl{font-size:11px;color:#64748b;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#f1f5f9;padding:7px 8px;text-align:left;font-weight:700;}td{padding:6px 8px;border-bottom:1px solid #f1f5f9;}.meta{background:#ede9fe;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;}@media print{button{display:none!important;}}</style></head><body>
<h1>💸 iGastei — ${monthLabel}</h1>
<div class="cards"><div class="card g"><div class="lbl">Entradas</div><div class="val" style="color:#16a34a">${fmt(totalIn)}</div></div><div class="card r"><div class="lbl">Gastos</div><div class="val" style="color:#dc2626">${fmt(totalOut)}</div></div><div class="card b"><div class="lbl">Saldo</div><div class="val" style="color:${saved>=0?"#7c3aed":"#d97706"}">${fmt(saved)}</div></div></div>
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
          <div><div style={{fontWeight:800,fontSize:14,color:"#00FF88"}}>{fmt(totalIn)}</div><div style={{fontSize:10,color:"#475569"}}>Entradas</div></div>
          <div><div style={{fontWeight:800,fontSize:14,color:"#FF3D7F"}}>{fmt(totalOut)}</div><div style={{fontSize:10,color:"#475569"}}>Gastos</div></div>
          <div><div style={{fontWeight:800,fontSize:14,color:balance>=0?"#FFD60A":"#FF3D7F"}}>{fmt(balance)}</div><div style={{fontSize:10,color:"#475569"}}>Saldo</div></div>
        </div>
      </div>
      {all.length===0 && <p style={S.empty}>Nenhum lançamento este mês</p>}
      {all.map(item=>{
        const cat=categories.find(c=>c.id===item.category)||{icon:item.kind==="income"?"💰":"📦",color:item.kind==="income"?"#00FF88":"#94a3b8",label:prettyCat(item.category)};
        const isIn=item.kind==="income";
        return(
          <div key={item.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22"}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"#e2e8f0",display:"flex",alignItems:"center",gap:6}}>
                {item.description}
                <span style={{fontSize:9,background:isIn?"#00FF8822":"#FF3D7F22",color:isIn?"#00FF88":"#FF3D7F",borderRadius:4,padding:"2px 6px",fontWeight:700}}>{isIn?"ENTRADA":"GASTO"}</span>
              </div>
              <div style={{fontSize:11,color:"#475569"}}>{item.date} · {item.userName||"—"} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:13,color:isIn?"#00FF88":"#FF3D7F"}}>{isIn?"+":"-"}{fmt(item.amount)}</div>
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
          <div key={d.month} style={{...S.card,marginBottom:10,borderLeft:isCurrent?"3px solid #00FF88":"3px solid #1e2035"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:800,fontSize:14,color:isCurrent?"#00FF88":"#e2e8f0"}}>{MONTHS[m2-1]} {y2}{isCurrent?" ← atual":""}</span>
              <span style={{fontSize:13,fontWeight:800,color:d.balance>=0?"#00FF88":"#FF3D7F"}}>{fmt(d.balance)}</span>
            </div>
            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                <span style={{color:"#00FF88"}}>💰 {fmt(d.totalIn)}</span>
              </div>
              <ProgressBar pct={pctIn} color="#00FF88"/>
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
  const [color,setColor]=useState("#6366f1");
  const [type,setType]=useState("expense");

  const openEdit=(cat)=>{ setEditItem(cat);setLabel(cat.label);setIcon(cat.icon);setColor(cat.color);setType(cat.type);setForm("edit"); };
  const save=()=>{
    if(!label)return;
    const id=editItem?editItem.id:(label.toLowerCase().replace(/\s+/g,"_")+Date.now());
    const cat={id,label,icon,color,type};
    if(editItem) onEdit(cat); else onAdd(cat);
    setForm(null);setLabel("");setIcon("📌");setColor("#6366f1");setType("expense");setEditItem(null);
  };
  const expMap={},incMap={};
  expenses.forEach(e=>{ expMap[e.category]=(expMap[e.category]||0)+Number(e.amount); });
  incomes.forEach(i=>{ incMap[i.category]=(incMap[i.category]||0)+Number(i.amount); });

  return(
    <div style={{paddingBottom:80}}>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>🏷️ Categorias</h2>
        <button style={S.btnPrimary} onClick={()=>{setForm("new");setEditItem(null);setLabel("");setIcon("📌");setColor("#6366f1");setType("expense");}}>+ Nova</button>
      </div>
      {form && (
        <div style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontWeight:700,color:"#e2e8f0"}}>{form==="edit"?"Editar":"Nova"} categoria</span>
            <button style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:18}} onClick={()=>setForm(null)}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={{...S.input,flex:"0 0 55px",textAlign:"center",fontSize:22,padding:"6px"}} value={icon} onChange={e=>setIcon(e.target.value)}/>
            <input style={{...S.input,flex:1}} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Nome"/>
            <input style={{...S.input,flex:"0 0 42px",padding:4,height:42}} type="color" value={color} onChange={e=>setColor(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[{v:"income",l:"💰 Entrada"},{v:"expense",l:"💸 Gasto"},{v:"both",l:"↕️ Ambos"}].map(o=>(
              <button key={o.v} onClick={()=>setType(o.v)}
                style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${type===o.v?"#00FF88":"#1e2035"}`,background:type===o.v?"#00FF8822":"#0D0D1A",color:"#e2e8f0",cursor:"pointer",fontWeight:600,fontSize:12}}>
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
                  <div style={{fontWeight:700,fontSize:12,color:"#e2e8f0"}}>{cat.label}</div>
                  <div style={{fontSize:10,color:"#475569",marginTop:2}}>{cat.type==="income"?"ENTRADA":cat.type==="expense"?"GASTO":"AMBOS"}</div>
                </div>
                <button style={{...S.btnIcon,fontSize:13}} onClick={()=>openEdit(cat)}>✏️</button>
              </div>
              {earned>0&&<div style={{fontSize:11,color:"#00FF88",fontWeight:600}}>+{fmt(earned)}</div>}
              {spent>0&&<div style={{fontSize:11,color:"#FF3D7F",fontWeight:600}}>-{fmt(spent)}</div>}
              {spent===0&&earned===0&&<div style={{fontSize:10,color:"#334155"}}>Sem movimentação</div>}
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
        <button onClick={()=>onTab("affiliates")} style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",marginBottom:14,border:"1px solid #00FF8844",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,rgba(0,255,136,.06),rgba(255,214,10,.04))"}}>
          <span style={{fontWeight:700,fontSize:14,color:"#e2e8f0"}}>🎯 Programa de Afiliados</span>
          <span style={{color:"#00FF88",fontWeight:800}}>abrir →</span>
        </button>
      )}

      {/* Plano */}
      <div style={{...S.card,marginBottom:14,background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid #00FF8833"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:"#6b7280"}}>plano atual</div>
            <div style={{fontWeight:800,fontSize:16,color:"#00FF88",marginTop:2}}>{plan.name}</div>
            <div style={{fontSize:11,color:"#475569",marginTop:2}}>{plan.limit===Infinity?"lançamentos ilimitados":`${plan.limit} lançamentos/mês`}</div>
          </div>
          {accountData?.plan==="explorador" && (
            <button style={{background:"linear-gradient(135deg,#00FF88,#FFD60A)",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:800,fontSize:13,color:"#0D0D1A",cursor:"pointer"}} onClick={onUpgrade}>
              Fazer upgrade ⚡
            </button>
          )}
        </div>
      </div>

      {/* Dados pessoais */}
      <div style={S.card}>
        <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",marginBottom:12}}>✏️ Dados pessoais</div>
        <div style={S.fg}><label style={S.label}>Como você quer ser chamado</label>
          <input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Yuri"/>
          <div style={{fontSize:10,color:"#475569",marginTop:3}}>É esse nome que aparece no “olá 👋” lá em cima</div>
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
        <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",marginBottom:4}}>👥 Membros da conta</div>
        <div style={{fontSize:11,color:"#475569",marginBottom:12}}>Adicione o e-mail de quem vai usar a mesma conta (ex: cônjuge).</div>
        {members.map(email=>(
          <div key={email} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e2035"}}>
            <div>
              <div style={{fontSize:13,color:"#e2e8f0"}}>{email}</div>
              {email===accountData?.ownerEmail&&<div style={{fontSize:10,color:"#00FF88"}}>titular</div>}
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
        <div style={{background:"#12182b",borderRadius:10,padding:"10px 12px",marginTop:12,fontSize:11,color:"#94a3b8",lineHeight:1.5}}>
          🔑 <b style={{color:"#cbd5e1"}}>Como a pessoa acessa:</b> depois de adicionada aqui, ela abre o app, clica em <b>“Criar conta grátis”</b> usando <b>esse mesmo e-mail</b> e escolhe a <b>senha dela</b>. Pronto — ela cai direto nesta conta compartilhada e vê os mesmos lançamentos. Cada um tem a própria senha; você não precisa saber a senha dela.
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
      <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Crie um código pra cada influenciador. Quem se cadastrar com o código conta como indicação dele. Você paga a comissão manualmente todo mês, com base nos indicados que estão pagando.</p>

      <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:12,marginBottom:16}}>
        <div style={S.card}><div style={{fontSize:11,color:"#6b7280"}}>Afiliados</div><div style={{fontWeight:900,fontSize:22,color:"#00FF88"}}>{affs.length}</div></div>
        <div style={S.card}><div style={{fontSize:11,color:"#6b7280"}}>Indicados pagando</div><div style={{fontWeight:900,fontSize:22,color:"#FFD60A"}}>{totalPaying}</div></div>
        <div style={S.card}><div style={{fontSize:11,color:"#6b7280"}}>A pagar/mês</div><div style={{fontWeight:900,fontSize:22,color:"#FF3D7F"}}>{fmt(totalOwed)}</div></div>
      </div>

      <div style={{...S.card,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:12}}>➕ Novo afiliado</div>
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
                <div style={{fontWeight:800,fontSize:15,color:"#e2e8f0"}}>{aff.name} {aff.instagram&&<span style={{color:"#6b7280",fontWeight:500,fontSize:12}}>{aff.instagram}</span>}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Código: <b style={{color:"#00FF88"}}>{aff.code}</b> · Comissão: <b>{aff.commissionPct}%</b></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,fontSize:18,color:"#FF3D7F"}}>{fmt(st.monthly)}</div>
                <div style={{fontSize:11,color:"#475569"}}>a pagar/mês</div>
              </div>
            </div>
            <div style={{display:"flex",gap:16,marginTop:10,fontSize:12,color:"#94a3b8"}}>
              <span>👥 {st.ref} indicados</span>
              <span>💳 {st.paying} pagando</span>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
              <input readOnly value={link} style={{...S.input,flex:1,fontSize:12,color:"#94a3b8"}}/>
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
      color: "#00FF88",
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
      color: "#FFD60A",
      featured: true,
    },
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#111827",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto",border:"1px solid #1e2035"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontWeight:900,fontSize:20,color:"#e2e8f0"}}>⚡ Fazer upgrade</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Desbloqueie tudo no iGastei</div>
          </div>
          <button style={{background:"none",border:"none",color:"#6b7280",fontSize:22,cursor:"pointer"}} onClick={onClose}>✕</button>
        </div>

        {/* Gerenciar assinatura (se já for pro) */}
        {currentPlan !== "explorador" && currentPlan !== "influencer" && (
          <div style={{background:"#00FF8815",border:"1px solid #00FF8833",borderRadius:12,padding:14,marginBottom:16}}>
            <div style={{fontSize:13,color:"#00FF88",fontWeight:700,marginBottom:4}}>✅ Você já tem o plano {currentPlan === "pro_mensal" ? "Pro Mensal" : "Pro Anual"}</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:10}}>Gerencie sua assinatura, veja faturas ou cancele quando quiser.</div>
            <button style={{background:"#1e2035",border:"1px solid #334155",color:"#e2e8f0",borderRadius:10,padding:"10px 16px",cursor:"pointer",fontWeight:700,fontSize:13,width:"100%"}}
              onClick={manageSubscription}>
              Gerenciar assinatura →
            </button>
          </div>
        )}

        {/* Planos */}
        {(currentPlan === "explorador" || currentPlan === "influencer") && (
          <>
            {plans.map(p => (
              <div key={p.id} style={{background:"#0D0D1A",border:`2px solid ${p.featured ? p.color+"44" : "#1e2035"}`,borderRadius:14,padding:16,marginBottom:12,position:"relative"}}>
                {p.featured && (
                  <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${p.color},#00FF88)`,color:"#0D0D1A",borderRadius:20,padding:"3px 14px",fontSize:10,fontWeight:900,whiteSpace:"nowrap"}}>
                    ⭐ Mais econômico
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:"#e2e8f0"}}>{p.icon} {p.name}</div>
                    {p.sub && <div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{p.sub}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    {p.originalPrice && <div style={{fontSize:11,color:"#475569",textDecoration:"line-through"}}>R${p.originalPrice}</div>}
                    <div style={{fontWeight:900,fontSize:22,color:p.color}}>R${p.price}</div>
                    <div style={{fontSize:10,color:"#6b7280"}}>{p.period}</div>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  {p.features.map(f => (
                    <div key={f} style={{fontSize:12,color:"#94a3b8",padding:"4px 0",display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{color:p.color,fontWeight:700}}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <button
                  style={{width:"100%",background:`linear-gradient(135deg,${p.color},${p.featured?"#00FF88":"#FFD60A"})`,border:"none",borderRadius:12,padding:"13px",fontWeight:900,fontSize:14,color:"#0D0D1A",cursor:"pointer",opacity:loading?0.7:1}}
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
            <div key={t} style={{fontSize:10,color:"#475569"}}>{t}</div>
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
      <div style={{background:"#111827",borderRadius:20,padding:32,maxWidth:340,width:"100%",textAlign:"center",border:"1px solid #00FF8833"}}>
        <div style={{fontSize:60,marginBottom:16}}>🎉</div>
        <div style={{fontWeight:900,fontSize:22,color:"#00FF88",marginBottom:8}}>Bem-vindo ao Pro!</div>
        <div style={{fontSize:14,color:"#6b7280",marginBottom:24,lineHeight:1.6}}>Seu plano foi ativado. Agora você tem acesso completo ao iGastei sem limites!</div>
        <button style={{background:"linear-gradient(135deg,#00FF88,#FFD60A)",border:"none",borderRadius:12,padding:"13px 24px",fontWeight:900,fontSize:14,color:"#0D0D1A",cursor:"pointer",width:"100%"}} onClick={onClose}>
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
  root:{minHeight:"100vh",background:"#0D0D1A",color:"#e2e8f0",fontFamily:"'Inter',system-ui,sans-serif",paddingBottom:90},
  // --- DESKTOP ---
  rootDesktop:{minHeight:"100vh",background:"#0D0D1A",color:"#e2e8f0",fontFamily:"'Inter',system-ui,sans-serif",display:"flex"},
  sidebar:{width:250,flexShrink:0,background:"#0a0d17",borderRight:"1px solid #1e2035",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"},
  sideItem:{display:"flex",alignItems:"center",gap:12,width:"100%",background:"none",border:"none",color:"#8b94ad",padding:"11px 14px",borderRadius:10,cursor:"pointer",fontSize:14.5,fontWeight:600,textAlign:"left",fontFamily:"inherit",transition:"background .15s,color .15s"},
  sideItemOn:{background:"linear-gradient(135deg,rgba(0,255,136,.14),rgba(255,214,10,.08))",color:"#00FF88",fontWeight:800},
  dMain:{flex:1,minWidth:0,display:"flex",flexDirection:"column"},
  topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 34px",borderBottom:"1px solid #1e2035",position:"sticky",top:0,background:"rgba(13,13,26,.85)",backdropFilter:"blur(10px)",zIndex:10},
  dContent:{padding:"26px 34px 60px",maxWidth:1160,width:"100%",margin:"0 auto"},
  header:{background:"#0D0D1A",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1e2035",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"},
  avatar:{width:36,height:36,background:"linear-gradient(135deg,#00FF88,#FFD60A)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:"#0D0D1A"},
  monthSel:{display:"flex",alignItems:"center",gap:4},
  monthBtn:{background:"#1e2035",border:"none",color:"#e2e8f0",borderRadius:6,width:26,height:26,cursor:"pointer",fontSize:14},
  btnLogout:{background:"transparent",border:"1px solid #1e2035",color:"#475569",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11},
  toast:{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",padding:"10px 20px",borderRadius:10,fontWeight:700,zIndex:999,fontSize:13,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,.5)"},
  loginRoot:{minHeight:"100vh",background:"#0D0D1A",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  loginCard:{background:"#111827",borderRadius:20,padding:28,width:"100%",maxWidth:380,border:"1px solid #1e2035",boxShadow:"0 20px 60px rgba(0,0,0,.5)"},
  main:{padding:"14px 16px",maxWidth:500,margin:"0 auto"},
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#111827",borderTop:"1px solid #1e2035",display:"flex",alignItems:"center",zIndex:10,height:64,padding:"0 8px"},
  bottomNavBtn:{flex:1,background:"none",border:"none",color:"#475569",padding:"8px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1},
  bottomNavBtnOn:{color:"#00FF88"},
  bottomNavCenter:{width:52,height:52,background:"linear-gradient(135deg,#00FF88,#FFD60A)",border:"none",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 20px #00FF8844",flexShrink:0,margin:"0 8px"},
  fg:{marginBottom:12},
  label:{display:"block",fontSize:11,color:"#6b7280",marginBottom:4,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"},
  input:{width:"100%",background:"#0D0D1A",border:"1px solid #1e2035",borderRadius:10,padding:"11px 13px",color:"#e2e8f0",fontSize:14,boxSizing:"border-box",outline:"none"},
  btnPrimary:{background:"linear-gradient(135deg,#00FF88,#FFD60A)",border:"none",color:"#0D0D1A",borderRadius:12,padding:"13px 20px",cursor:"pointer",fontWeight:900,fontSize:14,width:"100%"},
  btnGhost:{width:"100%",background:"#1e2035",border:"none",color:"#94a3b8",borderRadius:12,padding:13,cursor:"pointer",fontWeight:600,fontSize:14},
  btnLink:{background:"none",border:"none",color:"#00FF88",cursor:"pointer",fontSize:14,width:"100%",marginTop:8,padding:8,textAlign:"center"},
  btnSm:{background:"#1e2035",border:"none",color:"#94a3b8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:600,fontSize:11},
  btnIcon:{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4,opacity:.6},
  card:{background:"#111827",borderRadius:14,padding:14,border:"1px solid #1e2035"},
  secHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  secTitle:{fontWeight:900,fontSize:20,color:"#e2e8f0",margin:0,letterSpacing:"-0.5px"},
  listItem:{background:"#111827",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10,border:"1px solid #1e2035"},
  listIcon:{width:38,height:38,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
  chip:{background:"#1e2035",border:"none",color:"#6b7280",borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:600},
  chipOn:{background:"#00FF8822",color:"#00FF88"},
  empty:{color:"#334155",textAlign:"center",padding:32,fontSize:14},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{background:"#111827",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto",border:"1px solid #1e2035"},
};
