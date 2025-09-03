export async function handler() {
  const ok =
    !!process.env.APOLLO_API_KEY &&
    !!process.env.STRIPE_PAYMENT_LINK &&
    !!process.env.OUTBOUND_FROM_EMAIL;
  return {
    statusCode: ok ? 200 : 500,
    body: JSON.stringify({ ok, ts: Date.now() })
  };
}
