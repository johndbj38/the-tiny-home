require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: 'thetinyhome73@gmail.com',
    subject: 'Test email Resend ✅',
    text: 'Si vous recevez cet email, Resend fonctionne correctement !'
  });

  if (error) {
    console.error('❌ Erreur:', error);
  } else {
    console.log('✅ Email envoyé avec succès ! ID:', data.id);
  }
}

test();