require('dotenv').config();
const paypal = require('@paypal/checkout-server-sdk');

const clientId = process.env.PAYPAL_CLIENT_ID_SANDBOX;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET_SANDBOX;

const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
const client = new paypal.core.PayPalHttpClient(environment);

async function test() {
  try {
    const request = new paypal.orders.OrdersGetRequest('2TU62795BE307233R'); // un orderId valide ou test
    const response = await client.execute(request);
    console.log('Réponse PayPal:', response);
  } catch (err) {
    console.error('Erreur PayPal:', err);
  }
}

test();
