require('dotenv').config();
console.log('PWD:', process.cwd());
console.log('Fichier .env présent:', require('fs').existsSync('.env'));
console.log('PAYPAL_ID:', !!process.env.PAYPAL_CLIENT_ID_SANDBOX);
console.log('PAYPAL_SECRET:', !!process.env.PAYPAL_CLIENT_SECRET_SANDBOX);
