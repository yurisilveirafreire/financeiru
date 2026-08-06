/**
 * iGastei · Open Finance via Pluggy (SDK oficial pluggy-sdk)
 * ---------------------------------------------------------
 * Módulo SEPARADO de propósito: as Functions de pagamento (index.js) continuam
 * intocadas. Este arquivo só entra no ar quando:
 *   1) você criar o app na Pluggy (https://dashboard.pluggy.ai) e pegar
 *      CLIENT_ID e CLIENT_SECRET;
 *   2) instalar a dependência:  (dentro de /functions)  npm i pluggy-sdk
 *   3) setar os secrets:
 *        firebase functions:secrets:set PLUGGY_CLIENT_ID
 *        firebase functions:secrets:set PLUGGY_CLIENT_SECRET
 *   4) registrar os exports no index.js (2 linhas — ver README no fim);
 *   5) deploy:  firebase deploy --only functions
 *
 * Regra de negócio: Open Finance é EXCLUSIVO dos planos pagos.
 *   Liberado: pro_mensal, pro_anual, admin, influencer
 *   Bloqueado: explorador (grátis) -> o front manda pra tela de assinatura.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { PluggyClient } = require("pluggy-sdk");

// admin.initializeApp() já é chamado no index.js; reaproveitamos a instância.
const db = admin.firestore();

const PLUGGY_CLIENT_ID = defineSecret("PLUGGY_CLIENT_ID");
const PLUGGY_CLIENT_SECRET = defineSecret("PLUGGY_CLIENT_SECRET");

const PLANOS_COM_OPEN_FINANCE = ["pro_mensal", "pro_anual", "admin", "influencer"];

function getPluggy() {
  return new PluggyClient({
    clientId: PLUGGY_CLIENT_ID.value(),
    clientSecret: PLUGGY_CLIENT_SECRET.value(),
  });
}

// Descobre o plano ativo da conta do usuário (dono ou membro de conta compartilhada).
async function getPlanoDoUsuario(uid, email) {
  const own = await db.collection("accounts").doc(uid).get();
  if (own.exists && own.data().ownerId === uid) return own.data().plan;
  const snap = await db.collection("accounts")
    .where("members", "array-contains", email).limit(1).get();
  if (!snap.empty) return snap.docs[0].data().plan;
  return "explorador";
}

// accountId do iGastei = ownerId da conta (dono ou membro compartilham o mesmo)
async function getAccountId(uid, email) {
  const snap = await db.collection("accounts")
    .where("members", "array-contains", email).limit(1).get();
  if (!snap.empty) return snap.docs[0].data().ownerId || uid;
  return uid;
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

    const pluggy = getPluggy();
    const connectToken = await pluggy.createConnectToken({ clientUserId: uid });
    return { accessToken: connectToken.accessToken };
  }
);

/**
 * 2) Depois que o usuário conecta o banco no widget, o front manda o itemId.
 *    Buscamos as transações e gravamos como 'expenses'/'incomes' do accountId.
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

    const accountId = await getAccountId(uid, email);
    const pluggy = getPluggy();

    const { results: accounts = [] } = await pluggy.fetchAccounts(itemId);

    let importadas = 0;
    const batch = db.batch();
    for (const acc of accounts) {
      const { results: txs = [] } = await pluggy.fetchTransactions(acc.id, { pageSize: 200 });
      for (const t of txs) {
        // Pluggy: amount negativo = saída (despesa); positivo = entrada (receita)
        const isExpense = t.amount < 0;
        const col = isExpense ? "expenses" : "incomes";
        const docId = `pluggy_${t.id}`; // id determinístico -> não duplica no re-sync
        batch.set(db.collection(col).doc(docId), {
          accountId,
          value: Math.abs(t.amount),
          description: t.description || "Open Finance",
          category: "Open Finance",
          date: t.date ? String(t.date).slice(0, 10) : null,
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

 2) Dentro de /functions:  npm i pluggy-sdk

 3) Crie o app na Pluggy (https://dashboard.pluggy.ai), copie Client ID/Secret:
      firebase functions:secrets:set PLUGGY_CLIENT_ID
      firebase functions:secrets:set PLUGGY_CLIENT_SECRET

 4) Deploy:  firebase deploy --only functions
 ===========================================================================
*/
