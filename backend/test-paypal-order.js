require('dotenv').config();
const https = require('https');

const clientId = process.env.PAYPAL_CLIENT_ID_SANDBOX;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET_SANDBOX;
const orderId = process.argv[2];

if (!clientId || !clientSecret) {
  console.error('Variables PAYPAL manquantes dans .env');
  process.exit(1);
}
if (!orderId) {
  console.error('Usage: node test-paypal-order.js <ORDER_ID>');
  process.exit(1);
}

// 1) get token
function getToken() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const data = 'grant_type=client_credentials';
    const opts = {
      hostname: 'api-m.sandbox.paypal.com',
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      },
      timeout: 20000
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body).access_token); }
        catch(e){ reject(new Error('Impossible de parser token: '+body)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout getToken')); });
    req.write(data);
    req.end();
  });
}

// 2) get order
function getOrder(token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api-m.sandbox.paypal.com',
      path: `/v2/checkout/orders/${orderId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 60000 // 60s timeout
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout getOrder')); });
    req.end();
  });
}

(async () => {
  try {
    console.log('Test: récupération token...');
    const token = await getToken();
    console.log('Token OK, length:', token.length);
    console.log('Test: récupération order', orderId, 'avec timeout 60s...');
    const res = await getOrder(token);
    console.log('Order HTTP status:', res.status);
    console.log('Order body:', res.body);
  } catch (err) {
    console.error('Erreur test-paypal-order:', err && err.message ? err.message : err);
    console.error(err);
  }
})();
