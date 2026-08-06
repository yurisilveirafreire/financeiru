/**
 * iGastei · Open Finance via Pluggy
 * ---------------------------------
 * Módulo SEPARADO de propósito: as Functions de pagamento (index.js) continuam
 * intocadas. Este arquivo só entra no ar quando:
 *   1) você criar a conta na Pluggy (https://dashboard.pluggy.ai) e pegar
 *      CLIENT_ID e CLIENT_SECRET;
 *   2) setar os secrets:
 *        firebase functions:secrets:set PLUGGY_CLIENT_ID
 *        firebase functions:secrets:set PLUGGY_CLIENT_SECRET
 *   3) registrar os exports no index.js (2 linhas — ver README no fim);
 *   4) fazer o deploy: firebase deploy --only functions
 *
 * Regra de negócio: Open Finance é EXCLUSIVO dos planos pagos.
 *   Liberado: pro_mensal, pro_anual, admin, influencer
 *   Bloqueado: explorador (grátis) -> o front manda pra tela de assinatura.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// admin.initializeApp() já é chamado no index.js; reaproveitamos a instância.
const db = admin.firestore();

const PLUGGY_CLIENT_ID = defineSecret("PLUGGY_CLIENT_ID");
const PLUGGY_CLIENT_SECRET = defineSecret("PLUGGY_CLIENT_SECRET");

const PLUGGY_API = "https://api.pluggy.ai";
const PLANOS_COM_OPEN_FINANCE = ["pro_mensal", "pro_anual", "admin", "influencer"];

// Autentica na Pluggy e devolve o X-API-KEY (validade ~2h).
async function getApiKey() {
  const r = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: PLUGGY_CLIENT_ID.value(),
      clientSecret: PLUGGY_CLIENT_SECRET.value(),
    }),
  });
  if (!r.ok) throw new HttpsError("internal", "Falha ao autenticar na Pluggy.");
  const { apiKey } = await r.json();
  return apiKey;
}

// Descobre o plano ativo da conta do usuário (dono ou membro).
async function getPlanoDoUsuario(uid, email) {
  const own = await db.collection("accounts").doc(uid).get();
  if (own.exists && own.data().ownerId === uid) return own.data().plan;
  // membro de uma conta compartilhada
  const snap = await db.collection("accounts")
    .where("members", "array-contains", email).limit(1).get();
  if (!snap.empty) return snap.docs[0].data().plan;
  return "explorador";
}

/**
 * 1) Gera o connect token pro widget Pluggy Connect abrir no front.
 *    Só responde se o plano for pago; senão devolve erro que o front trata
 *    abrindo o modal de assinatura.
 */
exports.pluggyConnectToken = onCall(
  { secrets: [PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
    const uid = request.auth.uid;
    const email = request.auth.token.email;

    const plano = await getPlanoDoUsuario(uid, email);
    if (!PLANOS_COM_OPEN_FINANCE.includes(plano)) {
      // O front reconhece esse code e abre a tela de assinatura.
      throw new HttpsError("permission-denied", "OPEN_FINANCE_REQUER_PRO");
    }

    const apiKey = await getApiKey();
    const r = await fetch(`${PLUGGY_API}/connect_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ clientUserId: uid }),
    });
    if (!r.ok) throw new HttpsError("internal", "Falha ao criar connect token.");
    const { accessToken } = await r.json();
    return { accessToken };
  }
);

/**
 * 2) Depois que o usuário conecta o banco no widget, o front manda o itemId.
 *    Buscamos as transações e gravamos como 'expenses'/'incomes' do accountId.
 *    (Versão base — a mapear/testar junto quando você tiver a conta Pluggy.)
 */
exports.pluggySync = onCall(
  { secrets: [PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const { itemId } = request.data || {};
    if (!itemId) throw new HttpsError("invalid-argument", "itemId ausente.");

    const plano = await getPlanoDoUsuario(uid, email);
    if (!PLANOS_COM_OPEN_FINANCE.includes(plano)) {
      throw new HttpsError("permission-denied", "OPEN_FINANCE_REQUER_PRO");
    }

    // accountId do iGastei = ownerId da conta do usuário (dono ou membro)
    let accountId = uid;
    const snap = await db.collection("accounts")
      .where("members", "array-contains", email).limit(1).get();
    if (!snap.empty) accountId = snap.docs[0].data().ownerId || uid;

    const apiKey = await getApiKey();

    // contas bancárias do item conectado
    const accRes = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, {
      headers: { "X-API-KEY": apiKey },
    });
    const accounts = (await accRes.json()).results || [];

    let importadas = 0;
    const batch = db.batch();
    for (const acc of accounts) {
      const txRes = await fetch(`${PLUGGY_API}/transactions?accountId=${acc.id}&pageSize=100`, {
        headers: { "X-API-KEY": apiKey },
      });
      const txs = (txRes.ok ? (await txRes.json()).results : []) || [];
      for (const t of txs) {
        // Pluggy: amount negativo = saída (despesa); positivo = entrada (receita)
        const isExpense = t.amount < 0;
        const col = isExpense ? "expenses" : "incomes";
        // id determinístico evita duplicar no re-sync
        const docId = `pluggy_${t.id}`;
        const ref = db.collection(col).doc(docId);
        batch.set(ref, {
          accountId,
          value: Math.abs(t.amount),
          description: t.description || "Open Finance",
          category: "Open Finance",
          date: t.date ? t.date.slice(0, 10) : null,
          source: "pluggy",
          pluggyItemId: itemId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        importadas++;
      }
    }
    await batch.commit();
    return { ok: true, importadas };
  }
);

/*
 ============================ COMO LIGAR (deploy) ============================
 1) No functions/index.js, adicione ao FINAL do arquivo:

      const pluggy = require("./pluggy");
      exports.pluggyConnectToken = pluggy.pluggyConnectToken;
      exports.pluggySync = pluggy.pluggySync;

 2) Crie a conta e o app na Pluggy (https://dashboard.pluggy.ai), copie
    Client ID e Client Secret, e rode:

      firebase functions:secrets:set PLUGGY_CLIENT_ID
      firebase functions:secrets:set PLUGGY_CLIENT_SECRET

 3) Deploy:  firebase deploy --only functions

 Obs.: runtime Node 20+ tem fetch global (ok nas Functions v2). Se o seu
 runtime for mais antigo, instale node-fetch e importe no topo.
 ===========================================================================
*/
