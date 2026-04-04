// backend/index.js
require('dotenv').config();
const express = require('express');
const ical = require('node-ical');
const cors = require('cors');
const { Resend } = require('resend');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 4000;
const ICAL_URL = process.env.ICAL_URL;

if (!ICAL_URL) {
  console.error('Erreur: ICAL_URL non défini dans .env');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// --------------------
// Configuration Resend
// --------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'thetinyhome73@gmail.com';

let resend;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('Resend configuré avec succès');
} else {
  console.warn('RESEND_API_KEY non défini : les emails ne seront pas envoyés');
}

// --------------------
// Configuration PayPal
// --------------------
const clientIdSandbox = process.env.PAYPAL_CLIENT_ID_SANDBOX;
const clientSecretSandbox = process.env.PAYPAL_CLIENT_SECRET_SANDBOX;
const clientIdLive = process.env.PAYPAL_CLIENT_ID_LIVE;
const clientSecretLive = process.env.PAYPAL_CLIENT_SECRET_LIVE;

const isLivePaypal =
  process.env.NODE_ENV === 'production' &&
  clientIdLive &&
  clientSecretLive;

const PAYPAL_API_HOST = isLivePaypal
  ? 'api-m.paypal.com'
  : 'api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = isLivePaypal ? clientIdLive : clientIdSandbox;
const PAYPAL_CLIENT_SECRET = isLivePaypal ? clientSecretLive : clientSecretSandbox;

function paypalGetAccessToken() {
  return new Promise((resolve, reject) => {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return reject(
        new Error('Identifiants PayPal manquants (CLIENT_ID / CLIENT_SECRET)')
      );
    }

    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString('base64');
    const data = 'grant_type=client_credentials';

    const opts = {
      hostname: PAYPAL_API_HOST,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      },
      timeout: 20000
    };

    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (!json.access_token) {
            return reject(new Error('Réponse token invalide: ' + body));
          }
          resolve(json.access_token);
        } catch (e) {
          reject(new Error('Impossible de parser token: ' + body));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout getToken'));
    });

    req.write(data);
    req.end();
  });
}

function paypalGetOrder(orderId) {
  return new Promise((resolve, reject) => {
    paypalGetAccessToken()
      .then(token => {
        const opts = {
          hostname: PAYPAL_API_HOST,
          path: `/v2/checkout/orders/${orderId}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 30000
        };

        const req = https.request(opts, res => {
          let body = '';
          res.on('data', c => (body += c));
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, body });
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout getOrder'));
        });

        req.end();
      })
      .catch(reject);
  });
}

// --------------------
// Stockage (mémoire)
// --------------------
const reservations = [];

// --------------------
// Cache ICS
// --------------------
let cache = {
  ts: 0,
  ttlMs: 15 * 60 * 1000,
  data: null
};

function fetchIcs(url) {
  return new Promise((resolve, reject) => {
    ical.fromURL(url, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function parseEvents(icsData) {
  const events = [];
  for (const k in icsData) {
    const ev = icsData[k];
    if (ev && ev.type === 'VEVENT') {
      events.push({
        uid: ev.uid || null,
        summary: ev.summary || null,
        start: ev.start ? ev.start.toISOString() : null,
        end: ev.end ? ev.end.toISOString() : null,
        allDay: !!ev.datetype,
        raw: {
          location: ev.location || null,
          description: ev.description || null
        }
      });
    }
  }
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

function reservationsToEvents() {
  return reservations.map((r) => {
    const start = new Date(r.range[0]);
    const end = new Date(r.range[1]);
    return {
      uid: r.orderId || ('res-' + crypto.createHash('sha1').update(JSON.stringify(r)).digest('hex').slice(0, 8)),
      summary: `Réservation (payé) - ${r.prenom || ''} ${r.nom || ''}`,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: true,
      raw: { source: 'local-reservation', payer: r.payer || null }
    };
  });
}

// --------------------
// Route : availability
// --------------------
app.get('/api/availability', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.ts) < cache.ttlMs) {
      const merged = [...cache.data, ...reservationsToEvents()];
      merged.sort((a, b) => new Date(a.start) - new Date(b.start));
      return res.json({ source: 'cache', events: merged });
    }

    const ics = await fetchIcs(ICAL_URL);
    const events = parseEvents(ics);

    cache = { ts: now, ttlMs: cache.ttlMs, data: events };

    const merged = [...events, ...reservationsToEvents()];
    merged.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json({ source: 'remote', events: merged });
  } catch (err) {
    console.error('Erreur fetch/parse ICS:', err);
    res.status(500).json({ error: 'Impossible de récupérer ou parser le calendrier' });
  }
});

// --------------------
// Route : validation PayPal + enregistrement + mail
// --------------------
app.post('/api/paypal/complete', async (req, res) => {
  console.log('Requête reçue sur /api/paypal/complete avec body:', req.body);
  const { orderId, reservationData } = req.body;
  console.log('reservationData.range reçu :', reservationData.range);

  if (!orderId || !reservationData) {
    return res.status(400).json({ error: 'orderId ou reservationData manquant' });
  }

  try {
    console.log('Début validation PayPal pour orderId:', orderId);
    const paypalRes = await paypalGetOrder(orderId);

    console.log('Order HTTP status:', paypalRes.statusCode);
    console.log('Order body brut:', paypalRes.body);

    if (paypalRes.statusCode !== 200) {
      return res.status(400).json({
        error: 'Erreur lors de la vérification PayPal',
        details: paypalRes.body
      });
    }

    let order;
    try {
      order = JSON.parse(paypalRes.body);
    } catch (e) {
      console.error('Impossible de parser la réponse PayPal en JSON:', e);
      return res.status(500).json({ error: 'Réponse PayPal invalide (JSON)' });
    }

    if (order.status !== 'COMPLETED') {
      console.warn('Paiement non complété, statut:', order.status);
      return res.status(400).json({ error: 'Paiement non complété' });
    }

    // ---------- GESTION DATES ----------
    let rRange = null;
    let startStr = '';
    let endStr = '';

    if (reservationData.range && reservationData.range.length === 2) {
      const startDatePart = String(reservationData.range[0]).slice(0, 10);
      const endDatePart = String(reservationData.range[1]).slice(0, 10);

      rRange = [startDatePart, endDatePart];

      function formatFR(yyyyMmDd) {
        const [y, m, d] = yyyyMmDd.split('-');
        return `${d}/${m}/${y}`;
      }

      startStr = formatFR(startDatePart);
      endStr = formatFR(endDatePart);
    }

    const saved = {
      orderId,
      nom: reservationData.nom || '',
      prenom: reservationData.prenom || '',
      tel: reservationData.tel || '',
      email: reservationData.email || '',
      range: rRange,
      nights: reservationData.nights || 0,
      finalPrice: reservationData.finalPrice || 0,
      paymentStatus: order.status,
      payer: order.payer || null,
      createTime: order.create_time || new Date().toISOString()
    };

    reservations.push(saved);
    cache.ts = 0;

    console.log('Réservation sauvegardée en mémoire:', saved);

    // ---------- Envoi email via Resend ----------
    if (!RESEND_API_KEY || !resend) {
      console.warn('RESEND_API_KEY non configuré : pas d\'envoi de mail.');
      return res.json({
        success: true,
        message: 'Réservation enregistrée (mail non envoyé : Resend non configuré).'
      });
    }

    try {
      // Email 1 : pour le propriétaire
      await resend.emails.send({
        from: EMAIL_FROM,
        to: 'thetinyhome73@gmail.com',
        subject: `Nouvelle réservation - ${saved.prenom} ${saved.nom}`,
        text: `Bonjour,

Une nouvelle réservation a été confirmée et payée via PayPal.

📋 INFORMATIONS CLIENT :
- Nom : ${saved.prenom} ${saved.nom}
- Téléphone : ${saved.tel || '—'}
- Email : ${saved.email}

📅 DÉTAILS DU SÉJOUR :
- Arrivée : ${startStr}
- Départ : ${endStr}
- Nombre de nuits : ${saved.nights}
- Montant payé : ${saved.finalPrice} EUR

💳 PAIEMENT PAYPAL :
- Référence : ${saved.orderId}
- Statut : ${saved.paymentStatus}

⚠️ ACTION REQUISE :
Pensez à bloquer ces dates manuellement sur Airbnb pour éviter les doubles réservations.

Cordialement,
Votre site The Tiny Home`
      });
      console.log('Email propriétaire envoyé via Resend à thetinyhome73@gmail.com');

      // Email 2 : pour le client
      await resend.emails.send({
        from: EMAIL_FROM,
        to: saved.email,
        subject: 'Confirmation de votre réservation - The Tiny Home',
        text: `Bonjour ${saved.prenom || ''},

Merci 🙏 pour votre réservation à The Tiny Home ! 💚

Nous confirmons la bonne réception de votre paiement de ${saved.finalPrice} EUR.

📅 Récapitulatif de votre séjour :

📋 INFORMATIONS CLIENT :
- Nom : ${saved.prenom} ${saved.nom}
- Téléphone : ${saved.tel || '—'}
- Email : ${saved.email}

- Arrivée : ${startStr} check-in à partir de 16h
- Départ : ${endStr} check-out jusqu'à 12h midi
- Nombre de nuits : ${saved.nights} pour 2 personnes.

⚠️ RÈGLEMENT INTÉRIEUR :
- Aucune fête ni événement ne sont autorisés.
- Merci de respecter le calme après 22h sur la terrasse du SPA.
- Pas d'invités non prévus.
- La vaisselle doit être propre et rangée (un lave-vaisselle est à votre disposition).
- Enlever vos chaussures à l'intérieur.
- Ne pas manger ni boire dans les chambres.
- Interdiction de fumer dans le logement.
- Les animaux de compagnie ne sont pas admis.
- En cas de perte des clés : indemnisation de 40 €.
- Respectez le linge de maison (draps et serviettes inclus) : indemnisation de 50 € en cas de perte ou de détérioration.
- Un nettoyage supplémentaire entraînera une indemnisation de 150 €.
- Poubelles non jetées : indemnisation de 15 € (le conteneur se trouve en bas de la rue, près de la route principale).
- En cas de dégâts ou de non-respect du règlement intérieur : indemnisation de 300 €.

❤️ Merci pour votre compréhension et votre coopération.

🔑 Contactez nous (message) 1h avant votre arrivée pour la remise des clefs : +336 62 89 45 47 (numéro à joindre uniquement pour la remise des clefs, pas de renseignements)

📍 Adresse : 98 chemin de la combe 73420 Voglans.
🚗 1 place de parking sur place.

❕ Si vous avez la moindre question :
Vous pouvez nous contacter directement par email :
thetinyhome73@gmail.com

À très bientôt,
The Tiny Home`
      });
      console.log('Email client envoyé via Resend à', saved.email);

      return res.json({
        success: true,
        message: 'Réservation enregistrée et emails envoyés'
      });

    } catch (mailErr) {
      console.error('Erreur envoi email via Resend :', mailErr);
      return res.json({
        success: true,
        message: 'Réservation enregistrée (erreur envoi email).'
      });
    }

  } catch (err) {
    console.error('Erreur validation PayPal:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la validation PayPal' });
  }
});

// --------------------
// Start
// --------------------
app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
});