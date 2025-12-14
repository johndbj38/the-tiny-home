require('dotenv').config();
const https = require('https');

const clientId = process.env.PAYPAL_CLIENT_ID_SANDBOX;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET_SANDBOX;

if (!clientId || !clientSecret) {
  console.error('Variables PAYPAL manquantes dans .env');
  process.exit(1);
}

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const data = 'grant_type=client_credentials';

const options = {
  hostname: 'api-m.sandbox.paypal.com',
  path: '/v1/oauth2/token',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': data.length
  },
  timeout: 15000 // 15s timeout
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    try {
      console.log('Body JSON:', JSON.parse(body));
    } catch (e) {
      console.log('Body raw:', body);
    }
  });
});

req.on('error', (err) => {
  console.error('Erreur requête HTTPS:', err.message);
});
req.on('timeout', () => {
  console.error('Timeout lors de la requête vers PayPal');
  req.destroy();
});

req.write(data);
req.end();
