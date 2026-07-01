import { useState, useEffect } from "react";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD4GDfgBmYhr37B6gDeN1jv4lGb5EGvvxc",
  authDomain: "financeiru.firebaseapp.com",
  projectId: "financeiru",
  storageBucket: "financeiru.firebasestorage.app",
  messagingSenderId: "868386871849",
  appId: "1:868386871849:web:f8baa786b8f29456feda38",
};

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
  { id: "salario",     label: "Salário",          icon: "💼", color: "#22c55e", type: "income"  },
  { id: "freela",      label: "Freelance/Extra",  icon: "💡", color: "#06b6d4", type: "income"  },
  { id: "outros",      label: "Outros",           icon: "📦", color: "#94a3b8", type: "both"    },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const todayStr = () => { const d=new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
const monthKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };

let demoIncomes = [
  { id:"i1", userId:"u1", userName:"Você",   description:"Salário", amount:5500, category:"salario", date:"01/05/2025", month:"2025-05", createdAt:1 },
  { id:"i2", userId:"u2", userName:"Esposa", description:"Salário", amount:4200, category:"salario", date:"01/05/2025", month:"2025-05", createdAt:2 },
  { id:"i3", userId:"u1", userName:"Você",   description:"Freela",  amount:800,  category:"freela",  date:"15/05/2025", month:"2025-05", createdAt:3 },
];
let demoExpenses = [
  { id:"e1", userId:"u1", userName:"Você",   description:"Aluguel",  amount:1800, category:"moradia",     date:"05/05/2025", month:"2025-05", createdAt:4 },
  { id:"e2", userId:"u2", userName:"Esposa", description:"Mercado",  amount:650,  category:"alimentacao", date:"10/05/2025", month:"2025-05", createdAt:5 },
  { id:"e3", userId:"u1", userName:"Você",   description:"Gasolina", amount:280,  category:"transporte",  date:"12/05/2025", month:"2025-05", createdAt:6 },
  { id:"e4", userId:"u2", userName:"Esposa", description:"Farmácia", amount:120,  category:"saude",       date:"15/05/2025", month:"2025-05", createdAt:7 },
  { id:"e5", userId:"u1", userName:"Você",   description:"Netflix",  amount:75,   category:"lazer",       date:"18/05/2025", month:"2025-05", createdAt:8 },
  { id:"e6", userId:"u2", userName:"Esposa", description:"Academia", amount:110,  category:"pessoal",     date:"20/05/2025", month:"2025-05", createdAt:9 },
];
let demoCategories = [...DEFAULT_CATEGORIES];
let demoGoals = { "2025-05": 2000 };

export default function App() {
  const [screen, setScreen]     = useState("login");
  const [user, setUser]         = useState(null);
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

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3200); };

  useEffect(() => {
    getFirebase().then(f => {
      setFb(f);
      f.onAuthStateChanged(f.auth, u => { if(u){setUser(u);setScreen("app");} else setScreen("login"); });
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (demo) {
      setIncomes(demoIncomes.filter(i=>i.month===month));
      setExpenses(demoExpenses.filter(e=>e.month===month));
      setCategories(demoCategories);
      setGoal(demoGoals[month]||0);
      return;
    }
    if (!fb || !user) return;
    const { collection, query, where, onSnapshot, doc, getDoc, db } = fb;
    const u1 = onSnapshot(query(collection(db,"incomes"),where("month","==",month)), s=>setIncomes(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"expenses"),where("month","==",month)), s=>setExpenses(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(collection(db,"categories"), s=>{ const c=s.docs.map(d=>({id:d.id,...d.data()})); setCategories(c.length?c:DEFAULT_CATEGORIES); });
    getDoc(doc(db,"goals",month)).then(d=>setGoal(d.exists()?d.data().amount:0));
    return ()=>{u1();u2();u3();};
  }, [fb, user, month, demo]);

  const addItem = async (col, data) => {
    // 🛡️ TRAVA ANTI-SOBRESCRITA
    const newAmount = Number(data.amount);
    if (!newAmount || newAmount <= 0) {
      showToast("⚠️ Valor inválido. Use valores positivos.","error");
      return;
    }
    const currentTotal = col==="incomes"
      ? incomes.reduce((s,i)=>s+Number(i.amount),0)
      : expenses.reduce((s,e)=>s+Number(e.amount),0);
    if (currentTotal > 0 && newAmount > currentTotal * 10) {
      showToast("⚠️ Valor muito alto bloqueado. Verifique e tente novamente.","error");
      return;
    }
    const item = { ...data, userId: user.uid, userName: user.displayName||user.email, month, createdAt: Date.now() };
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
    if (demo) { demoCategories=[...demoCategories,cat]; setCategories(p=>[...p,cat]); }
    else await fb.setDoc(fb.doc(fb.db,"categories",cat.id),cat);
    showToast("Categoria criada ✅");
  };

  const editCategory = async (cat) => {
    if (demo) { demoCategories=demoCategories.map(c=>c.id===cat.id?cat:c); setCategories(demoCategories); }
    else await fb.setDoc(fb.doc(fb.db,"categories",cat.id),cat);
    showToast("Categoria atualizada ✅");
  };

  const saveGoal = async (v) => {
    setGoal(v);
    if (demo) { demoGoals[month]=v; return; }
    await fb.setDoc(fb.doc(fb.db,"goals",month),{amount:v});
    showToast("Meta salva ✅");
  };

  const handleLogout = async () => {
    if (demo){ setDemo(false);setUser(null);setScreen("login");return; }
    await fb.signOut(fb.auth);
  };

  const totalIn  = incomes.reduce((s,i)=>s+Number(i.amount),0);
  const totalOut = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const balance  = totalIn - totalOut;

  if (screen==="login") return (
    <LoginScreen loading={loading} toast={toast}
      onLogin={async(email,pass,reg)=>{
        if(!fb){showToast("Firebase não configurado — use Demo","error");return;}
        setLoading(true);
        try{ if(reg) await fb.createUserWithEmailAndPassword(fb.auth,email,pass); else await fb.signInWithEmailAndPassword(fb.auth,email,pass); }
        catch(e){showToast(e.message,"error");}
        setLoading(false);
      }}
      onDemo={()=>{setDemo(true);setUser({uid:"u1",email:"demo@financeiro.com",displayName:"Demo"});setScreen("app");}}
    />
  );

  return (
    <div style={S.root}>
      {toast && <div style={{...S.toast, background: toast.type==="error"?"#ef4444":toast.type==="info"?"#6366f1":"#10b981"}}>{toast.msg}</div>}
      <Header month={month} onMonth={setMonth} demo={demo} onLogout={handleLogout} />
      <Nav tab={tab} onTab={setTab} />
      <main style={S.main}>
        {tab==="dashboard"  && <Dashboard incomes={incomes} expenses={expenses} categories={categories} totalIn={totalIn} totalOut={totalOut} balance={balance} goal={goal} month={month} onGoal={saveGoal} />}
        {tab==="incomes"    && <Incomes   incomes={incomes}   categories={categories} onAdd={d=>addItem("incomes",d)}  onEdit={(id,d)=>editItem("incomes",id,d)}  onDelete={id=>deleteItem("incomes",id)}  onAddCat={addCategory} />}
        {tab==="expenses"   && <Expenses  expenses={expenses} categories={categories} onAdd={d=>addItem("expenses",d)} onEdit={(id,d)=>editItem("expenses",id,d)} onDelete={id=>deleteItem("expenses",id)} onAddCat={addCategory} />}
        {tab==="history"    && <History   incomes={incomes}   expenses={expenses} categories={categories} month={month} totalIn={totalIn} totalOut={totalOut} balance={balance} goal={goal} />}
        {tab==="categories" && <Categories categories={categories} expenses={expenses} incomes={incomes} onAdd={addCategory} onEdit={editCategory} />}
      </main>
    </div>
  );
}

function LoginScreen({onLogin,onDemo,loading,toast}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [reg,setReg]=useState(false);
  return(
    <div style={S.loginRoot}>
      {toast && <div style={{...S.toast,background:toast.type==="error"?"#ef4444":"#10b981"}}>{toast.msg}</div>}
      <div style={S.loginCard}>
        <div style={{fontSize:48,textAlign:"center",marginBottom:8}}>💚</div>
        <h1 style={{textAlign:"center",fontSize:26,fontWeight:900,letterSpacing:"-1px",color:"#10b981",margin:"0 0 4px"}}>financeirU</h1>
        <p style={{textAlign:"center",color:"#64748b",fontSize:14,marginBottom:24}}>Finanças da casa, juntos</p>
        <div style={S.fg}><label style={S.label}>E-mail</label><input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com"/></div>
        <div style={S.fg}><label style={S.label}>Senha</label><input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"/></div>
        <button style={S.btnGreen} onClick={()=>onLogin(email,pass,reg)} disabled={loading}>{loading?"Aguarde...":reg?"Criar conta":"Entrar"}</button>
        <button style={S.btnLink} onClick={()=>setReg(!reg)}>{reg?"Já tenho conta":"Criar nova conta"}</button>
        <div style={{textAlign:"center",color:"#334155",margin:"14px 0",borderTop:"1px solid #334155",lineHeight:0}}><span style={{background:"#1e293b",padding:"0 12px",color:"#475569"}}>ou</span></div>
        <button style={S.btnGhost} onClick={onDemo}>🎮 Experimentar (Demo)</button>
      </div>
    </div>
  );
}

function Header({month,onMonth,demo,onLogout}){
  const [y,m]=month.split("-").map(Number);
  const prev=()=>{ const d=new Date(y,m-2,1); onMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const next=()=>{ const d=new Date(y,m,1);   onMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  return(
    <header style={S.header}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:22}}>💚</span>
        <div>
          <div style={{fontWeight:900,fontSize:17,letterSpacing:"-0.5px",color:"#e2e8f0"}}>financeirU</div>
          {demo && <div style={{fontSize:10,background:"#f59e0b",color:"#000",borderRadius:4,padding:"1px 6px",fontWeight:700,display:"inline-block"}}>DEMO</div>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={S.monthSel}>
          <button style={S.monthBtn} onClick={prev}>‹</button>
          <span style={{fontSize:13,fontWeight:700,minWidth:72,textAlign:"center"}}>{MONTHS[m-1]} {y}</span>
          <button style={S.monthBtn} onClick={next}>›</button>
        </div>
        <button style={S.btnLogout} onClick={onLogout}>Sair</button>
      </div>
    </header>
  );
}

function Nav({tab,onTab}){
  const tabs=[
    {id:"dashboard",  icon:"📊",label:"Dashboard"},
    {id:"incomes",    icon:"💰",label:"Entradas"},
    {id:"expenses",   icon:"💸",label:"Gastos"},
    {id:"history",    icon:"📋",label:"Histórico"},
    {id:"categories", icon:"🏷️",label:"Categorias"},
  ];
  return(
    <nav style={S.nav}>
      {tabs.map(t=>(
        <button key={t.id} style={{...S.navBtn,...(tab===t.id?S.navBtnOn:{})}} onClick={()=>onTab(t.id)}>
          <span style={{fontSize:17}}>{t.icon}</span>
          <span style={{fontSize:10,fontWeight:600}}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Dashboard({incomes,expenses,categories,totalIn,totalOut,balance,goal,month,onGoal}){
  const [editGoal,setEditGoal]=useState(false);
  const [gInput,setGInput]=useState(goal);

  const byCatExp={};
  expenses.forEach(e=>{ byCatExp[e.category]=(byCatExp[e.category]||0)+Number(e.amount); });

  const byCatInc={};
  incomes.forEach(i=>{ byCatInc[i.category]=(byCatInc[i.category]||0)+Number(i.amount); });

  const byPerson={};
  incomes.forEach(i=>{ const k=i.userName||"—"; if(!byPerson[k]) byPerson[k]={in:0,out:0}; byPerson[k].in+=Number(i.amount); });
  expenses.forEach(e=>{ const k=e.userName||"—"; if(!byPerson[k]) byPerson[k]={in:0,out:0}; byPerson[k].out+=Number(e.amount); });

  const saved=balance;
  const goalPct=goal>0?Math.min(100,Math.round((saved/goal)*100)):0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[
          {label:"Entradas",val:fmt(totalIn), icon:"💰",color:"#10b981",sub:`${incomes.length} lançamentos`},
          {label:"Gastos",  val:fmt(totalOut),icon:"💸",color:"#ef4444",sub:`${expenses.length} lançamentos`},
          {label:"Saldo",   val:fmt(balance), icon:balance>=0?"✅":"⚠️",color:balance>=0?"#6366f1":"#f59e0b",sub:balance>=0?"Positivo!":"Atenção!"},
        ].map(c=>(
          <div key={c.label} style={{...S.card,borderTop:`3px solid ${c.color}`,textAlign:"center",padding:12}}>
            <div style={{fontSize:20}}>{c.icon}</div>
            <div style={{fontWeight:800,fontSize:14,color:c.color,marginTop:2}}>{c.val}</div>
            <div style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>{c.label}</div>
            <div style={{fontSize:10,color:"#64748b"}}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={S.cardTitle}>🎯 Meta de Economia</span>
          <button style={S.btnSm} onClick={()=>{setEditGoal(!editGoal);setGInput(goal);}}>{editGoal?"Cancelar":"Editar"}</button>
        </div>
        {editGoal?(
          <div style={{display:"flex",gap:8}}>
            <input style={{...S.input,flex:1,marginBottom:0}} type="number" value={gInput} onChange={e=>setGInput(Number(e.target.value))} placeholder="Ex: 2000"/>
            <button style={{...S.btnGreen,width:"auto",padding:"0 16px"}} onClick={()=>{onGoal(gInput);setEditGoal(false);}}>Salvar</button>
          </div>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
              <span style={{fontWeight:700,color:"#6366f1"}}>{fmt(saved)} economizados</span>
              <span style={{color:"#94a3b8"}}>meta: {fmt(goal)}</span>
            </div>
            <ProgressBar pct={goalPct} color={goalPct>=100?"#10b981":"#6366f1"}/>
            <div style={{textAlign:"right",fontSize:11,color:"#94a3b8",marginTop:3}}>{goalPct}%</div>
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>💑 Resumo por pessoa</div>
        {Object.entries(byPerson).map(([name,v])=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:32,height:32,background:"#6366f1",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:14}}>{name[0].toUpperCase()}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{name}</div>
              <div style={{display:"flex",gap:12,fontSize:12}}>
                <span style={{color:"#10b981"}}>+{fmt(v.in)}</span>
                <span style={{color:"#ef4444"}}>-{fmt(v.out)}</span>
                <span style={{color:v.in-v.out>=0?"#6366f1":"#f59e0b",fontWeight:700}}>=&nbsp;{fmt(v.in-v.out)}</span>
              </div>
            </div>
          </div>
        ))}
        {Object.keys(byPerson).length===0 && <p style={S.empty}>Nenhum lançamento este mês</p>}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>💰 Receitas por categoria</div>
        {Object.keys(byCatInc).length===0 && <p style={S.empty}>Nenhuma entrada registrada</p>}
        {Object.entries(byCatInc).sort((a,b)=>b[1]-a[1]).map(([cid,val])=>{
          const cat=categories.find(c=>c.id===cid)||{label:cid,icon:"💼",color:"#22c55e"};
          const pct=totalIn>0?(val/totalIn)*100:0;
          return(
            <div key={cid} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,fontWeight:600}}>{cat.icon} {cat.label}</span>
                <span style={{fontWeight:700,color:cat.color}}>{fmt(val)}</span>
              </div>
              <ProgressBar pct={pct} color={cat.color}/>
            </div>
          );
        })}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>🏷️ Gastos por categoria</div>
        {Object.keys(byCatExp).length===0 && <p style={S.empty}>Nenhum gasto registrado</p>}
        {Object.entries(byCatExp).sort((a,b)=>b[1]-a[1]).map(([cid,val])=>{
          const cat=categories.find(c=>c.id===cid)||{label:cid,icon:"📦",color:"#94a3b8"};
          const pct=totalOut>0?(val/totalOut)*100:0;
          return(
            <div key={cid} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,fontWeight:600}}>{cat.icon} {cat.label}</span>
                <span style={{fontWeight:700,color:cat.color}}>{fmt(val)}</span>
              </div>
              <ProgressBar pct={pct} color={cat.color}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({pct,color}){
  return <div style={{height:8,background:"#334155",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:4,transition:"width .5s"}}/></div>;
}

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
  const [ncColor,setNcColor]=useState(isIncome?"#22c55e":"#6366f1");

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
          <h3 style={{color:"#e2e8f0",fontWeight:800,fontSize:16,margin:0}}>{item?"Editar":"Nova"} {isIncome?"Entrada":"Despesa"}</h3>
          <button style={{background:"none",border:"none",color:"#94a3b8",fontSize:20,cursor:"pointer"}} onClick={onClose}>✕</button>
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <label style={S.label}>Categoria</label>
            <button style={{...S.btnSm,fontSize:11}} onClick={()=>setNewCat(!newCat)}>{newCat?"Cancelar":"+ Nova"}</button>
          </div>
          {newCat?(
            <div style={{background:"#0f172a",borderRadius:10,padding:12,marginBottom:8}}>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input style={{...S.input,flex:"0 0 60px",textAlign:"center",fontSize:20,padding:"6px"}} value={ncIcon} onChange={e=>setNcIcon(e.target.value)}/>
                <input style={{...S.input,flex:1}} value={ncLabel} onChange={e=>setNcLabel(e.target.value)} placeholder="Nome da categoria"/>
                <input style={{...S.input,flex:"0 0 44px",padding:4,height:42}} type="color" value={ncColor} onChange={e=>setNcColor(e.target.value)}/>
              </div>
              <button style={{...S.btnGreen,fontSize:13}} onClick={saveNewCat}>Criar e selecionar</button>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
              {validCats.map(c=>(
                <button key={c.id} onClick={()=>setCat(c.id)}
                  style={{background:cat===c.id?c.color+"33":"#0f172a",border:`2px solid ${cat===c.id?c.color:"#334155"}`,borderRadius:8,padding:"8px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:"#e2e8f0",fontSize:13,fontWeight:600}}>
                  <span style={{fontSize:18}}>{c.icon}</span>
                  <span style={{flex:1,textAlign:"left",fontSize:12}}>{c.label}</span>
                  <span style={{fontSize:10,background:isIncome?"#10b981":"#ef4444",color:"#fff",borderRadius:4,padding:"1px 5px"}}>{isIncome?"IN":"OUT"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button style={{...S.btnGreen,marginTop:8}} onClick={()=>{ if(!desc||!amt)return; onSave({description:desc,amount:Number(amt),category:cat,date}); }}>
          {item?"Atualizar":"Salvar"} {isIncome?"entrada":"gasto"}
        </button>
      </div>
    </div>
  );
}

function Incomes({incomes,categories,onAdd,onEdit,onDelete,onAddCat}){
  const [form,setForm]=useState(null);
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?incomes:incomes.filter(i=>i.category===filter);
  const activeCats=[...new Set(incomes.map(i=>i.category))].map(id=>categories.find(c=>c.id===id)).filter(Boolean);
  const totalAll=incomes.reduce((s,i)=>s+Number(i.amount),0);
  const totalFiltered=filtered.reduce((s,i)=>s+Number(i.amount),0);
  const filterCat=filter!=="all"?categories.find(c=>c.id===filter):null;
  return(
    <div>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>💰 Entradas</h2>
        <button style={S.btnGreen} onClick={()=>setForm("new")}>+ Adicionar</button>
      </div>
      {form && <ItemForm type="income" categories={categories} item={form==="new"?null:form} onAddCat={onAddCat} onSave={d=>{ form==="new"?onAdd(d):onEdit(form.id,d); setForm(null); }} onClose={()=>setForm(null)}/>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        <button style={{...S.chip,...(filter==="all"?S.chipOn:{})}} onClick={()=>setFilter("all")}>Todos</button>
        {activeCats.map(c=>(
          <button key={c.id} style={{...S.chip,...(filter===c.id?{...S.chipOn,background:c.color}:{})}} onClick={()=>setFilter(filter===c.id?"all":c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {filter!=="all" && filterCat && (
        <div style={{...S.card,marginBottom:12,borderLeft:`4px solid ${filterCat.color}`,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>{filterCat.icon} {filterCat.label}</div>
              <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{filtered.length} lançamento{filtered.length!==1?"s":""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:18,color:filterCat.color}}>+{fmt(totalFiltered)}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{totalAll>0?((totalFiltered/totalAll)*100).toFixed(1):0}% do total</div>
            </div>
          </div>
        </div>
      )}
      {filter==="all" && incomes.length>0 && (
        <div style={{...S.card,marginBottom:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>💰 Total do mês</div>
          <div style={{fontWeight:900,fontSize:16,color:"#10b981"}}>+{fmt(totalAll)}</div>
        </div>
      )}
      {filtered.length===0 && <p style={S.empty}>Nenhuma entrada {filter!=="all"?"nesta categoria":"este mês"}</p>}
      {[...filtered].sort((a,b)=>b.createdAt-a.createdAt).map(inc=>{
        const cat=categories.find(c=>c.id===inc.category)||{icon:"💼",color:"#10b981",label:"Renda"};
        return(
          <div key={inc.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22",fontSize:20}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{inc.description}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{inc.date} · {inc.userName} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#10b981"}}>+{fmt(inc.amount)}</div>
            <div style={{display:"flex",gap:4}}>
              <button style={S.btnIcon} onClick={()=>setForm(inc)}>✏️</button>
              <button style={S.btnIcon} onClick={()=>onDelete(inc.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Expenses({expenses,categories,onAdd,onEdit,onDelete,onAddCat}){
  const [form,setForm]=useState(null);
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?expenses:expenses.filter(e=>e.category===filter);
  const activeCats=[...new Set(expenses.map(e=>e.category))].map(id=>categories.find(c=>c.id===id)).filter(Boolean);
  const totalAll=expenses.reduce((s,e)=>s+Number(e.amount),0);
  const totalFiltered=filtered.reduce((s,e)=>s+Number(e.amount),0);
  const filterCat=filter!=="all"?categories.find(c=>c.id===filter):null;
  return(
    <div>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>💸 Gastos</h2>
        <button style={S.btnGreen} onClick={()=>setForm("new")}>+ Adicionar</button>
      </div>
      {form && <ItemForm type="expense" categories={categories} item={form==="new"?null:form} onAddCat={onAddCat} onSave={d=>{ form==="new"?onAdd(d):onEdit(form.id,d); setForm(null); }} onClose={()=>setForm(null)}/>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        <button style={{...S.chip,...(filter==="all"?S.chipOn:{})}} onClick={()=>setFilter("all")}>Todos</button>
        {activeCats.map(c=>(
          <button key={c.id} style={{...S.chip,...(filter===c.id?{...S.chipOn,background:c.color}:{})}} onClick={()=>setFilter(filter===c.id?"all":c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {filter!=="all" && filterCat && (
        <div style={{...S.card,marginBottom:12,borderLeft:`4px solid ${filterCat.color}`,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>{filterCat.icon} {filterCat.label}</div>
              <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{filtered.length} lançamento{filtered.length!==1?"s":""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:18,color:filterCat.color}}>-{fmt(totalFiltered)}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{totalAll>0?((totalFiltered/totalAll)*100).toFixed(1):0}% do total</div>
            </div>
          </div>
        </div>
      )}
      {filter==="all" && expenses.length>0 && (
        <div style={{...S.card,marginBottom:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>💸 Total do mês</div>
          <div style={{fontWeight:900,fontSize:16,color:"#ef4444"}}>-{fmt(totalAll)}</div>
        </div>
      )}
      {filtered.length===0 && <p style={S.empty}>Nenhum gasto {filter!=="all"?"nesta categoria":"este mês"}</p>}
      {[...filtered].sort((a,b)=>b.createdAt-a.createdAt).map(exp=>{
        const cat=categories.find(c=>c.id===exp.category)||{icon:"📦",color:"#94a3b8",label:"Outros"};
        return(
          <div key={exp.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22",fontSize:20}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{exp.description}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{exp.date} · {exp.userName} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#ef4444"}}>-{fmt(exp.amount)}</div>
            <div style={{display:"flex",gap:4}}>
              <button style={S.btnIcon} onClick={()=>setForm(exp)}>✏️</button>
              <button style={S.btnIcon} onClick={()=>onDelete(exp.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function History({incomes,expenses,categories,month,totalIn,totalOut,balance,goal}){
  const [y,m]=month.split("-").map(Number);
  const monthLabel=`${MONTHS[m-1]} ${y}`;
  const all=[...incomes.map(i=>({...i,kind:"income"})),...expenses.map(e=>({...e,kind:"expense"}))].sort((a,b)=>b.createdAt-a.createdAt);

  const generatePDF=()=>{
    const byCat={};
    expenses.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+Number(e.amount); });
    const rows=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cid,v])=>{
      const cat=categories.find(c=>c.id===cid)||{label:cid,icon:"📦"};
      return `<tr><td>${cat.icon} ${cat.label}</td><td style="text-align:right;color:#ef4444">${fmt(v)}</td><td style="text-align:right">${totalOut>0?((v/totalOut)*100).toFixed(1)+"%":"-"}</td></tr>`;
    }).join("");
    const incRows=incomes.map(i=>{ const cat=categories.find(c=>c.id===i.category)||{label:i.category,icon:"💰"}; return `<tr><td>${i.date}</td><td>${i.description}</td><td>${i.userName||"—"}</td><td>${cat.icon} ${cat.label}</td><td style="color:#10b981;text-align:right">+${fmt(i.amount)}</td></tr>`; }).join("");
    const expRows=expenses.map(e=>{ const cat=categories.find(c=>c.id===e.category)||{label:e.category,icon:"📦"}; return `<tr><td>${e.date}</td><td>${e.description}</td><td>${e.userName||"—"}</td><td>${cat.icon} ${cat.label}</td><td style="color:#ef4444;text-align:right">-${fmt(e.amount)}</td></tr>`; }).join("");
    const saved=totalIn-totalOut;
    const goalPct=goal>0?Math.min(100,((saved/goal)*100).toFixed(1))+"%":"—";
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>financeirU – ${monthLabel}</title><style>*{box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;max-width:800px;margin:0 auto;}h1{color:#10b981;}h2{color:#6366f1;border-bottom:2px solid #e2e8f0;padding-bottom:6px;}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0;}.card{border-radius:10px;padding:16px;text-align:center;}.green{background:#dcfce7;}.red{background:#fee2e2;}.blue{background:#ede9fe;}.val{font-size:20px;font-weight:900;margin:4px 0;}.lbl{font-size:12px;color:#64748b;}table{width:100%;border-collapse:collapse;font-size:13px;}th{background:#f1f5f9;padding:8px;text-align:left;}td{padding:7px 8px;border-bottom:1px solid #f1f5f9;}.meta{background:#ede9fe;border-radius:8px;padding:16px;margin:16px 0;}@media print{button{display:none!important;}}</style></head><body>
<h1>💚 financeirU — ${monthLabel}</h1>
<div class="cards"><div class="card green"><div class="lbl">Entradas</div><div class="val" style="color:#16a34a">${fmt(totalIn)}</div></div><div class="card red"><div class="lbl">Gastos</div><div class="val" style="color:#dc2626">${fmt(totalOut)}</div></div><div class="card blue"><div class="lbl">Saldo</div><div class="val" style="color:${saved>=0?"#7c3aed":"#d97706"}">${fmt(saved)}</div></div></div>
<div class="meta">🎯 Meta: <strong>${fmt(goal)}</strong> | Economizado: <strong>${fmt(saved)}</strong> | Progresso: <strong>${goalPct}</strong></div>
<h2>💰 Entradas</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${incRows||"<tr><td colspan=5>Nenhuma entrada</td></tr>"}</tbody></table>
<h2>💸 Gastos</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${expRows||"<tr><td colspan=5>Nenhum gasto</td></tr>"}</tbody></table>
<h2>🏷️ Por categoria</h2><table><thead><tr><th>Categoria</th><th>Valor</th><th>%</th></tr></thead><tbody>${rows||"<tr><td colspan=3>Sem dados</td></tr>"}</tbody></table>
<script>window.onload=()=>window.print();</script></body></html>`;
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html"})),"_blank");
  };

  return(
    <div>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>📋 Histórico</h2>
        <button style={{...S.btnGreen,width:"auto",padding:"10px 16px",fontSize:13}} onClick={generatePDF}>📄 Gerar PDF</button>
      </div>
      <div style={{...S.card,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
          <div><div style={{fontSize:13,fontWeight:800,color:"#10b981"}}>{fmt(totalIn)}</div><div style={{fontSize:11,color:"#94a3b8"}}>Entradas</div></div>
          <div><div style={{fontSize:13,fontWeight:800,color:"#ef4444"}}>{fmt(totalOut)}</div><div style={{fontSize:11,color:"#94a3b8"}}>Gastos</div></div>
          <div><div style={{fontSize:13,fontWeight:800,color:balance>=0?"#6366f1":"#f59e0b"}}>{fmt(balance)}</div><div style={{fontSize:11,color:"#94a3b8"}}>Saldo</div></div>
        </div>
      </div>
      {all.length===0 && <p style={S.empty}>Nenhum lançamento este mês</p>}
      {all.map(item=>{
        const cat=categories.find(c=>c.id===item.category)||{icon:item.kind==="income"?"💰":"📦",color:item.kind==="income"?"#10b981":"#94a3b8",label:"—"};
        const isIn=item.kind==="income";
        return(
          <div key={item.id} style={S.listItem}>
            <div style={{...S.listIcon,background:cat.color+"22",fontSize:18}}>{cat.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:6}}>
                {item.description}
                <span style={{fontSize:10,background:isIn?"#10b981":"#ef4444",color:"#fff",borderRadius:4,padding:"1px 5px"}}>{isIn?"ENTRADA":"GASTO"}</span>
              </div>
              <div style={{fontSize:11,color:"#64748b"}}>{item.date} · {item.userName||"—"} · <span style={{color:cat.color}}>{cat.label}</span></div>
            </div>
            <div style={{fontWeight:800,fontSize:14,color:isIn?"#10b981":"#ef4444"}}>{isIn?"+":"-"}{fmt(item.amount)}</div>
          </div>
        );
      })}
    </div>
  );
}

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

  const typeBadge=(t)=>{
    if(t==="income")  return <span style={{fontSize:10,background:"#10b981",color:"#fff",borderRadius:4,padding:"2px 6px",fontWeight:700}}>ENTRADA</span>;
    if(t==="expense") return <span style={{fontSize:10,background:"#ef4444",color:"#fff",borderRadius:4,padding:"2px 6px",fontWeight:700}}>GASTO</span>;
    return <span style={{fontSize:10,background:"#6366f1",color:"#fff",borderRadius:4,padding:"2px 6px",fontWeight:700}}>AMBOS</span>;
  };

  return(
    <div>
      <div style={S.secHeader}>
        <h2 style={S.secTitle}>🏷️ Categorias</h2>
        <button style={S.btnGreen} onClick={()=>{setForm("new");setEditItem(null);setLabel("");setIcon("📌");setColor("#6366f1");setType("expense");}}>+ Nova</button>
      </div>
      {form && (
        <div style={{...S.card,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontWeight:700,color:"#e2e8f0"}}>{form==="edit"?"Editar":"Nova"} categoria</span>
            <button style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}} onClick={()=>setForm(null)}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={{...S.input,flex:"0 0 60px",textAlign:"center",fontSize:22,padding:"6px"}} value={icon} onChange={e=>setIcon(e.target.value)}/>
            <input style={{...S.input,flex:1}} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Nome da categoria"/>
            <input style={{...S.input,flex:"0 0 44px",padding:4,height:42}} type="color" value={color} onChange={e=>setColor(e.target.value)}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={S.label}>Tipo</label>
            <div style={{display:"flex",gap:8}}>
              {[{v:"income",l:"💰 Entrada"},{v:"expense",l:"💸 Gasto"},{v:"both",l:"↕️ Ambos"}].map(o=>(
                <button key={o.v} onClick={()=>setType(o.v)}
                  style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${type===o.v?"#6366f1":"#334155"}`,background:type===o.v?"#6366f122":"#0f172a",color:"#e2e8f0",cursor:"pointer",fontWeight:600,fontSize:13}}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <button style={S.btnGreen} onClick={save}>{form==="edit"?"Atualizar":"Criar"} categoria</button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {categories.map(cat=>{
          const spent=expMap[cat.id]||0;
          const earned=incMap[cat.id]||0;
          return(
            <div key={cat.id} style={{...S.card,borderLeft:`4px solid ${cat.color}`,padding:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:24}}>{cat.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{cat.label}</div>
                  <div style={{marginTop:2}}>{typeBadge(cat.type)}</div>
                </div>
                <button style={{...S.btnIcon,fontSize:14}} onClick={()=>openEdit(cat)}>✏️</button>
              </div>
              {(cat.type==="income"||cat.type==="both")&&earned>0&&<div style={{fontSize:12,color:"#10b981",fontWeight:600}}>+{fmt(earned)}</div>}
              {(cat.type==="expense"||cat.type==="both")&&spent>0&&<div style={{fontSize:12,color:"#ef4444",fontWeight:600}}>-{fmt(spent)}</div>}
              {spent===0&&earned===0&&<div style={{fontSize:11,color:"#475569"}}>Sem movimentação</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S={
  root:{minHeight:"100vh",background:"#0f172a",color:"#e2e8f0",fontFamily:"'Nunito',sans-serif",paddingBottom:80},
  header:{background:"#1e293b",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #334155",position:"sticky",top:0,zIndex:10},
  nav:{display:"flex",background:"#1e293b",borderBottom:"1px solid #334155",position:"sticky",top:57,zIndex:9},
  navBtn:{flex:1,background:"none",border:"none",color:"#64748b",padding:"9px 2px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:"2px solid transparent"},
  navBtnOn:{color:"#10b981",borderBottom:"2px solid #10b981"},
  main:{padding:14,maxWidth:700,margin:"0 auto"},
  monthSel:{display:"flex",alignItems:"center",gap:4},
  monthBtn:{background:"#334155",border:"none",color:"#e2e8f0",borderRadius:6,width:26,height:26,cursor:"pointer",fontSize:15,lineHeight:1},
  btnLogout:{background:"transparent",border:"1px solid #475569",color:"#94a3b8",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12},
  toast:{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",padding:"10px 20px",borderRadius:8,color:"#fff",fontWeight:700,zIndex:999,fontSize:13,whiteSpace:"nowrap"},
  loginRoot:{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  loginCard:{background:"#1e293b",borderRadius:16,padding:28,width:"100%",maxWidth:380,border:"1px solid #334155"},
  fg:{marginBottom:12},
  label:{display:"block",fontSize:12,color:"#94a3b8",marginBottom:4,fontWeight:700},
  input:{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"10px 12px",color:"#e2e8f0",fontSize:14,boxSizing:"border-box",outline:"none"},
  btnGreen:{background:"#10b981",border:"none",color:"#fff",borderRadius:10,padding:"12px 20px",cursor:"pointer",fontWeight:800,fontSize:14,width:"100%"},
  btnGhost:{width:"100%",background:"#334155",border:"none",color:"#cbd5e1",borderRadius:10,padding:12,cursor:"pointer",fontWeight:600,fontSize:14},
  btnLink:{background:"none",border:"none",color:"#10b981",cursor:"pointer",fontSize:14,width:"100%",marginTop:6,padding:8},
  btnSm:{background:"#334155",border:"none",color:"#cbd5e1",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:600,fontSize:12},
  btnIcon:{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4,opacity:.6},
  card:{background:"#1e293b",borderRadius:12,padding:14,border:"1px solid #334155"},
  cardTitle:{fontWeight:700,fontSize:14,marginBottom:12,color:"#e2e8f0",display:"block"},
  secHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  secTitle:{fontWeight:900,fontSize:18,color:"#e2e8f0",margin:0},
  listItem:{background:"#1e293b",borderRadius:10,padding:"11px 13px",marginBottom:8,display:"flex",alignItems:"center",gap:10,border:"1px solid #334155"},
  listIcon:{width:36,height:36,background:"#334155",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"},
  chip:{background:"#334155",border:"none",color:"#94a3b8",borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600},
  chipOn:{background:"#6366f1",color:"#fff"},
  empty:{color:"#475569",textAlign:"center",padding:24,fontSize:14},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{background:"#1e293b",borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto",border:"1px solid #334155"},
};
