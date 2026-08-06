const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

const PRICES = {
  pro_mensal: "price_1U0W6mCQQCrPw3DqvKZ33c06",
  pro_anual:  "price_1U0W6kCQQCrPw3Dq90B1J66O",
};

exports.createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const stripe = require("stripe")(stripeSecretKey.value());
  const { plan, successUrl, cancelUrl } = request.data;
  const uid = request.auth.uid;
  const email = request.auth.token.email;
  const accountRef = db.collection("accounts").doc(uid);
  const accountDoc = await accountRef.get();
  let customerId = accountDoc.data()?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { firebaseUID: uid } });
    customerId = customer.id;
    await accountRef.update({ stripeCustomerId: customerId });
  }
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: PRICES[plan], quantity: 1 }],
    success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
    cancel_url: cancelUrl,
    locale: "pt-BR",
    allow_promotion_codes: false,
    subscription_data: { metadata: { firebaseUID: uid, plan } },
  });
  return { url: session.url };
});

exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripe = require("stripe")(stripeSecretKey.value());
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  const { type, data } = event;
  if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
    const sub = data.object;
    const uid = sub.metadata?.firebaseUID;
    const plan = sub.metadata?.plan;
    if (uid && plan && sub.status === "active") {
      await db.collection("accounts").doc(uid).update({
        plan, stripeSubscriptionId: sub.id,
        planActivatedAt: admin.firestore.FieldValue.serverTimestamp(), planStatus: "active",
      });
    }
  }
  if (type === "customer.subscription.deleted" || type === "invoice.payment_failed") {
    const customerId = data.object.customer;
    const snap = await db.collection("accounts").where("stripeCustomerId", "==", customerId).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.update({ plan: "explorador", planStatus: "cancelled" });
  }
  res.json({ received: true });
});

exports.createPortalSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const stripe = require("stripe")(stripeSecretKey.value());
  const accountDoc = await db.collection("accounts").doc(request.auth.uid).get();
  const customerId = accountDoc.data()?.stripeCustomerId;
  if (!customerId) throw new HttpsError("not-found", "Nenhuma assinatura encontrada.");
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: request.data.returnUrl });
  return { url: session.url };
});

exports.validateCoupon = onCall(async (request) => {
  const couponDoc = await db.collection("coupons").doc(request.data.code.toUpperCase()).get();
  if (!couponDoc.exists) throw new HttpsError("not-found", "Cupom inválido.");
  const coupon = couponDoc.data();
  if (new Date() > new Date(coupon.validUntil)) throw new HttpsError("failed-precondition", "Cupom expirado.");
  await couponDoc.ref.update({ uses: admin.firestore.FieldValue.increment(1) });
  if (coupon.plan === "influencer" && request.auth) {
    await db.collection("accounts").doc(request.auth.uid).update({ plan: "influencer", planStatus: "active" });
    return { type: "influencer", message: "Acesso Influencer ativado!" };
  }
  return { type: "discount", discount: coupon.discount, plan: coupon.plan };
});

// --- Open Finance (Pluggy) — módulo separado ---
const pluggy = require("./pluggy");
exports.pluggyConnectToken = pluggy.pluggyConnectToken;
exports.pluggySync = pluggy.pluggySync;
