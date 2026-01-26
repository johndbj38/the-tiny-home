// src/components/AvailabilityCalendar.tsx
import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

// --- TYPES ET CONFIGURATION ---
type EventItem = {
  uid: string | null;
  summary: string | null;
  start: string | null;
  end: string | null;
};

const DEFAULT_PRICE_PER_NIGHT = 149;
const TARGET_EMAIL = 'thetinyhome73@gmail.com';

// Liste des prix pour les périodes spéciales
const SPECIAL_PRICES = [
  { start: '2025-12-24', end: '2025-12-26', price: 200 },
  { start: '2026-02-14', end: '2026-02-14', price: 250 },
  { start: '2026-02-13', end: '2026-02-13', price: 250 },
  { start: '2025-12-31', end: '2026-01-01', price: 250 },
];

export default function AvailabilityCalendar() {
  // --- ÉTATS (STATES) ---
  const [loading, setLoading] = useState(true);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<Date[] | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Champs du formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isRulesAccepted, setIsRulesAccepted] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

  // --- RÉCUPÉRATION DES DONNÉES (BACKEND) ---
  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/availability`);
        const json = await res.json();
        const ev: EventItem[] = json.events || [];
        
        const booked = new Set<string>();
        ev.forEach(e => {
          if (e.start && e.end) {
            const start = new Date(e.start);
            const end = new Date(e.end);
            // On remplit le Set avec les dates occupées au format YYYY-MM-DD
            for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
              booked.add(dateToYMD(new Date(d)));
            }
          }
        });
        setBookedSet(booked);
      } catch (err) {
        console.error("Erreur calendrier:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [API_BASE_URL]);

  // --- FONCTIONS UTILITAIRES ---
  
  // Convertit une date en texte "2024-07-15" pour comparer facilement
  function dateToYMD(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Vérifie si une date tombe en Juillet (6) ou Août (7)
  function isJulyOrAugust(date: Date): boolean {
    const month = date.getMonth();
    return month === 6 || month === 7;
  }

  // Calcule le nombre de nuits et le prix total
  function calcNightsAndPrice(range: Date[] | null) {
    if (!range || range.length !== 2) return { nights: 0, finalPrice: 0 };
    const s = new Date(range[0]);
    const e = new Date(range[1]);
    const nights = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    
    let totalPrice = 0;
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
      let p = DEFAULT_PRICE_PER_NIGHT;
      const dStr = dateToYMD(d);
      SPECIAL_PRICES.forEach(sp => {
        if (dStr >= sp.start && dStr <= sp.end) p = sp.price;
      });
      totalPrice += p;
    }

    // Remises : 10% dès 3 nuits, 15% dès 7 nuits
    let disc = 0;
    if (nights >= 7) disc = 15; else if (nights >= 3) disc = 10;
    const discAmt = (totalPrice * disc) / 100;
    return { nights, finalPrice: totalPrice - discAmt };
  }

  const { nights, finalPrice } = calcNightsAndPrice(range);

  // --- VALIDATION ---

  // Le formulaire est valide si tous les champs sont remplis + règlement coché
  const isFormValid = nom.trim() !== '' && prenom.trim() !== '' && email.includes('@') && tel.trim() !== '' && range?.length === 2 && isRulesAccepted;

  // Vérifie les règles de durée de séjour
  function validateForm() {
    setFormError(null);
    if (!isFormValid) {
      setFormError("Veuillez remplir tous les champs et accepter le règlement.");
      return false;
    }
    const s = range![0];
    // Règle Dimanche (2 nuits min)
    if (s.getDay() === 0 && nights < 2) {
      setFormError("Pour une arrivée le dimanche, le séjour doit être d'au moins 2 nuits.");
      return false;
    }
    // Règle Juillet/Août (3 nuits min)
    if (isJulyOrAugust(s) && nights < 3) {
      setFormError("En juillet et août, le séjour minimum est de 3 nuits.");
      return false;
    }
    return true;
  }

  // Prépare le lien mailto (sujet et corps du message)
  function buildMailtoLink() {
    const subject = `Demande de contact - ${prenom} ${nom}`;
    let body = "Bonjour, je souhaiterais avoir des informations sur la Tiny Home.";
    if (range) {
      body += `\n\nDates souhaitées : du ${range[0].toLocaleDateString()} au ${range[1].toLocaleDateString()}`;
      body += `\nNombre de nuits : ${nights}`;
      body += `\nPrix estimé : ${finalPrice}€`;
    }
    return `mailto:${TARGET_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // --- RENDU (JSX) ---
  return (
    <section id="availability" className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <h3 className="text-2xl font-bold mb-6 text-center">Calendrier & réservation</h3>
        
        {/* Calendrier interactif */}
        <div className="flex justify-center mb-6">
          <Calendar 
            locale="fr-FR" 
            selectRange 
            onChange={(v) => setRange(v as Date[])} 
            tileClassName={({date}) => bookedSet.has(dateToYMD(date)) ? 'booked-day' : ''}
          />
        </div>

        {/* Légende (Corrigée pour Netlify) */}
        <div className="mb-6 text-center text-xs text-gray-500">
           <p>Cases grises : indisponible. | Moitié grise : départ possible.</p>
        </div>

        {/* Formulaire client */}
        <form className="bg-gray-50 p-6 rounded-lg shadow-sm" onSubmit={e => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} className="border p-2 rounded" />
            <input placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} className="border p-2 rounded" />
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded" />
            <input placeholder="Téléphone" value={tel} onChange={e => setTel(e.target.value)} className="border p-2 rounded" />
          </div>

          {/* Case à cocher Règlement */}
          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={isRulesAccepted} onChange={e => setIsRulesAccepted(e.target.checked)} />
            <label className="text-sm">
              J'accepte le <button type="button" onClick={() => setShowRulesModal(true)} className="underline text-blue-600">règlement intérieur</button>
            </label>
          </div>

          {/* Affichage des erreurs */}
          {formError && <p className="text-red-500 mt-2 text-sm font-bold">{formError}</p>}

          {/* BOUTONS D'ACTION */}
          <div className="mt-8 space-y-4">
            
            {/* Bouton PayPal (bloqué si formulaire invalide) */}
            <PayPalScriptProvider options={{ "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID, currency: "EUR" }}>
              <div className={!isFormValid ? 'opacity-50 pointer-events-none' : ''}>
                <PayPalButtons 
                  disabled={!isFormValid}
                  createOrder={(data, actions) => {
                    if (!validateForm()) return Promise.reject(); // Vérifie les 3 nuits ici
                    return actions.order.create({ 
                      purchase_units: [{ amount: { value: finalPrice.toFixed(2), currency_code: "EUR" } }] 
                    });
                  }}
                />
              </div>
            </PayPalScriptProvider>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bouton Airbnb (bloqué si formulaire invalide) */}
              <a 
                href="https://www.airbnb.fr/rooms/746228202767512240" 
                target="_blank" 
                rel="noreferrer"
                className={`bg-red-500 text-white text-center py-3 rounded-lg font-bold ${!isFormValid ? 'opacity-50 pointer-events-none' : ''}`}
              >
                🎒 Réserver sur Airbnb
              </a>

              {/* Bouton Email (TOUJOURS ACTIF) */}
              <a 
                href={buildMailtoLink()} 
                className="bg-green-600 text-white text-center py-3 rounded-lg font-bold hover:bg-green-700 transition-colors"
              >
                ✉️ Nous contacter par Email
              </a>
            </div>
          </div>
        </form>
      </div>

      {/* Fenêtre surgissante (Modal) pour le règlement */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg max-w-md shadow-xl">
            <h4 className="font-bold mb-4">Règlement intérieur</h4>
            <ul className="text-sm space-y-2 mb-4 list-disc list-inside">
              <li>Pas de fêtes ni d'événements.</li>
              <li>Calme après 22h (surtout au SPA).</li>
              <li>Logement non fumeur.</li>
              <li>Animaux non admis.</li>
            </ul>
            <button onClick={() => setShowRulesModal(false)} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Fermer</button>
          </div>
        </div>
      )}
    </section>
  );
}
