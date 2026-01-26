// src/components/AvailabilityCalendar.tsx
import React, { useEffect, useState, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

type EventItem = {
  uid: string | null;
  summary: string | null;
  start: string | null;
  end: string | null;
};

// ============================================
// 🔧 CONFIGURATION DES PRIX - MODIFIABLE ICI
// ============================================
const PRICE_WEEKDAY = 139;  // € / nuit du lundi au vendredi (nuits lun-mar, mar-mer, mer-jeu, jeu-ven)
const PRICE_WEEKEND = 149;  // € / nuit du weekend (nuits ven-sam et sam-dim)

// Définition des prix spéciaux par date (reconduits tous les ans)
// Format : mois (1-12) et jour
const SPECIAL_PRICES = [
  { month: 12, startDay: 24, endDay: 26, price: 200 }, // Noël (24-26 décembre)
  { month: 12, startDay: 31, endDay: 31, price: 250 }, // Nouvel an (31 décembre)
  { month: 1, startDay: 1, endDay: 1, price: 250 },    // Nouvel an (1er janvier)
  { month: 2, startDay: 13, endDay: 13, price: 200 },  // Saint-Valentin (13 février)
  { month: 2, startDay: 14, endDay: 14, price: 250 },  // Saint-Valentin (14 février)
];

// ============================================
// 🔧 CONFIGURATION DE LA FENÊTRE DE RÉSERVATION
// ============================================
const MAX_BOOKING_MONTHS = 6; // Nombre de mois maximum pour les réservations futures
// ============================================

const TARGET_EMAIL = 'thetinyhome73@gmail.com';

export default function AvailabilityCalendar() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [arrivalSet, setArrivalSet] = useState<Set<string>>(new Set());
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [range, setRange] = useState<Date[] | null>(null);

  // Form fields
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

  // Calcul des dates limites (mémorisé pour éviter les recalculs)
  const { today, maxFuture } = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxFuture = new Date(today);
    maxFuture.setMonth(maxFuture.getMonth() + MAX_BOOKING_MONTHS);
    maxFuture.setHours(0, 0, 0, 0);
    
    return { today, maxFuture };
  }, []);

  useEffect(() => {
    async function fetchEvents() {
      const startTime = performance.now();
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/availability`);
        const fetchTime = performance.now();
        console.log('⏱️ Temps fetch API:', Math.round(fetchTime - startTime), 'ms');
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const ev: EventItem[] = json.events || [];
        setEvents(ev);

        const booked = new Set<string>();
        const arrivals = new Set<string>();

        // Traitement optimisé : on ne traite que les événements dans la fenêtre visible
        for (const e of ev) {
          if (!e.start || !e.end) continue;
          
          const start = new Date(e.start);
          const end = new Date(e.end);
          
          // Si l'événement est complètement hors de la fenêtre visible, on le saute
          if (end < today || start > maxFuture) continue;
          
          // Clamper les dates à la fenêtre visible
          const clampedStart = start < today ? today : start;
          const clampedEnd = end > maxFuture ? maxFuture : end;
          
          const startYmd = dateToYMD(start);
          arrivals.add(startYmd);

          // Remplir les jours réservés (optimisé : pas de new Date() inutile)
          for (let d = new Date(clampedStart); d < clampedEnd; d.setDate(d.getDate() + 1)) {
            booked.add(dateToYMD(d));
          }
        }

        // Nettoyer les arrivées qui ne sont pas possibles (jour précédent réservé)
        for (const ymd of Array.from(arrivals)) {
          const [year, month, day] = ymd.split('-').map(Number);
          const d = new Date(year, month - 1, day);
          d.setDate(d.getDate() - 1);
          const prevYmd = dateToYMD(d);
          if (booked.has(prevYmd)) {
            arrivals.delete(ymd);
          }
        }

        setBookedSet(booked);
        setArrivalSet(arrivals);
        
        const endTime = performance.now();
        console.log('⏱️ Temps total traitement:', Math.round(endTime - startTime), 'ms');
        console.log('📊 Dates réservées:', booked.size, '| Arrivées possibles:', arrivals.size);
        
      } catch (err: any) {
        setError(err.message || 'Erreur inconnue');
        setBookedSet(new Set());
        setArrivalSet(new Set());
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [API_BASE_URL, today, maxFuture]);

  function dateToYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Fonction optimisée avec useCallback pour éviter les re-créations
  const tileDisabled = useCallback(({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return false;
    
    // Désactiver les dates passées (sans Set)
    if (date < today) return true;
    
    // Désactiver les dates au-delà de la fenêtre de réservation
    if (date > maxFuture) return true;
    
    return false;
  }, [today, maxFuture]);

  // Fonction optimisée avec useCallback
  const tileClassName = useCallback(({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return '';
    const ymd = dateToYMD(date);
    const classes: string[] = [];
    
    if (bookedSet.has(ymd)) {
      classes.push('booked-day');
    }
    if (arrivalSet.has(ymd)) {
      classes.push('arrival-day');
    }
    
    return classes.join(' ');
  }, [bookedSet, arrivalSet]);

  function formatDate(d: Date) {
    return d.toLocaleDateString('fr-FR');
  }

  function calcNightsAndPrice(range: Date[] | null) {
    if (!range || range.length !== 2 || !range[0] || !range[1]) {
      return { nights: 0, price: 0, discountPercent: 0, discountAmount: 0, finalPrice: 0 };
    }

    const start = new Date(range[0]);
    const end = new Date(range[1]);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.round((end.getTime() - start.getTime()) / msPerDay);
    const nights = diff > 0 ? diff : 0;

    let totalPrice = 0;
    if (nights > 0) {
      for (let d = new Date(start); d.getTime() < end.getTime(); d.setDate(d.getDate() + 1)) {
        const dMonth = d.getMonth() + 1;
        const dDay = d.getDate();
        const dayOfWeek = d.getDay();

        // Vérifier d'abord si cette nuit correspond à un prix spécial
        let priceForThisNight = null;
        for (const specialPrice of SPECIAL_PRICES) {
          if (dMonth === specialPrice.month && dDay >= specialPrice.startDay && dDay <= specialPrice.endDay) {
            priceForThisNight = specialPrice.price;
            break;
          }
        }

        // Si pas de prix spécial, appliquer la tarification semaine/weekend
        if (priceForThisNight === null) {
          if (dayOfWeek === 5 || dayOfWeek === 6) {
            priceForThisNight = PRICE_WEEKEND;
          } else {
            priceForThisNight = PRICE_WEEKDAY;
          }
        }

        totalPrice += priceForThisNight;
      }
    }

    let discountPercent = 0;
    if (nights >= 7) discountPercent = 15;
    else if (nights >= 3) discountPercent = 10;

    const discountAmountCents = Math.round((totalPrice * discountPercent / 100) * 100);
    const discountAmountFinal = discountAmountCents / 100;
    const finalPrice = Math.round((totalPrice - discountAmountFinal) * 100) / 100;

    return {
      nights,
      price: Math.round(totalPrice * 100) / 100,
      discountPercent,
      discountAmount: discountAmountFinal,
      finalPrice,
    };
  }

  const { nights, price, discountPercent, discountAmount, finalPrice } = calcNightsAndPrice(range);

  const [isRulesAccepted, setIsRulesAccepted] = useState(false);

  // Fonction pour vérifier si le séjour est en juillet ou août
  function isInJulyOrAugust(range: Date[] | null): boolean {
    if (!range || range.length !== 2) return false;
    const start = new Date(range[0]);
    const end = new Date(range[1]);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const month = d.getMonth();
      if (month === 6 || month === 7) {
        return true;
      }
    }
    return false;
  }

  // Validation pour le paiement
  const isFormValid =
    nom.trim() !== '' &&
    prenom.trim() !== '' &&
    email.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    tel.trim() !== '' &&
    range !== null &&
    range.length === 2 &&
    nights > 0 &&
    isRulesAccepted &&
    !(isInJulyOrAugust(range) && nights < 2);

  function validateForm() {
    setFormError(null);
    if (!nom.trim()) return setFormError('Le nom est requis.');
    if (!prenom.trim()) return setFormError('Le prénom est requis.');
    if (!email.trim()) return setFormError("L'adresse mail est requise.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError('Adresse mail invalide.');
    if (!tel.trim()) return setFormError('Le numéro de téléphone est requis.');
    if (!range || range.length !== 2 || nights <= 0)
      return setFormError('Veuillez sélectionner une plage de dates valide (au moins 1 nuit).');
    if (!isRulesAccepted)
      return setFormError('Vous devez accepter le règlement intérieur pour réserver.');

    if (isInJulyOrAugust(range) && nights < 2) {
      return setFormError('⚠️ Pour les séjours en juillet et août, la réservation doit être d\'au moins 2 nuits.');
    }

    if (range && range.length === 2) {
      const s = new Date(range[0]);
      const e = new Date(range[1]);
      const arrivalDay = s.getDay();
      if (arrivalDay === 0 && nights < 2) {
        return setFormError("Pour une arrivée le dimanche, le séjour doit être d'au moins 2 nuits.");
      }

      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
        if (bookedSet.has(dateToYMD(d))) {
          return setFormError('La plage sélectionnée contient des dates indisponibles. Choisissez une autre plage.');
        }
      }
    }
    return true;
  }

  function buildMailBody() {
    const baseInfo = [
      'Demande de contact - The Tiny Home',
      '',
      `Nom : ${nom || 'Non renseigné'}`,
      `Prénom : ${prenom || 'Non renseigné'}`,
      `Téléphone : ${tel || 'Non renseigné'}`,
      `Adresse e-mail : ${email || 'Non renseigné'}`,
      '',
    ];

    if (range && range.length === 2) {
      const startStr = formatDate(range[0]);
      const endStr = formatDate(range[1]);
      return [
        ...baseInfo,
        'DÉTAILS DU SÉJOUR SÉLECTIONNÉ :',
        `Arrivée : ${startStr}`,
        `Départ : ${endStr}`,
        `Nuits : ${nights}`,
        `Prix total : ${finalPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`,
        '',
        'Merci de revenir vers moi au plus vite.',
      ].join('\n');
    }

    return [
      ...baseInfo,
      'Message : [Veuillez écrire votre question ici]',
      '',
      'Merci de revenir vers moi au plus vite.',
    ].join('\n');
  }

  function buildMailtoLink() {
    const subject = `Demande de contact - The Tiny Home ${prenom || nom ? `(${prenom} ${nom})` : ''}`;
    const body = buildMailBody();
    return `mailto:${TARGET_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function openMailClient() {
    const mailto = buildMailtoLink();
    window.location.href = mailto;
  }

  const displayedPricePerNight = (() => {
    if (range && range.length === 2) {
      const startDay = new Date(range[0]);
      const dMonth = startDay.getMonth() + 1;
      const dDay = startDay.getDate();
      const dayOfWeek = startDay.getDay();

      for (const specialPrice of SPECIAL_PRICES) {
        if (dMonth === specialPrice.month && dDay >= specialPrice.startDay && dDay <= specialPrice.endDay) {
          return specialPrice.price;
        }
      }

      if (dayOfWeek === 5 || dayOfWeek === 6) {
        return PRICE_WEEKEND;
      } else {
        return PRICE_WEEKDAY;
      }
    }
    return PRICE_WEEKDAY;
  })();

  // Gestion optimisée du changement de dates
  const handleCalendarChange = useCallback((val: Date | Date[] | null) => {
    if (loading) return;

    if (Array.isArray(val)) {
      const [start, end] = val;
      if (!start || !end) {
        setRange(null);
        return;
      }

      const s = new Date(start);
      const e = new Date(end);
      s.setHours(0, 0, 0, 0);
      e.setHours(0, 0, 0, 0);

      if (e < s) {
        [s as any, e as any] = [e, s];
      }

      let conflict = false;
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
        if (bookedSet.has(dateToYMD(d))) {
          conflict = true;
          break;
        }
      }

      if (conflict) setRange(null);
      else setRange([s, e]);
    } else if (val instanceof Date) {
      const clicked = new Date(val);
      clicked.setHours(0, 0, 0, 0);

      if (clicked < today || clicked > maxFuture) {
        setRange(null);
        return;
      }

      const next = new Date(clicked);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);

      if (arrivalSet.has(dateToYMD(next)) && !bookedSet.has(dateToYMD(next)))
        setRange([clicked, next]);
      else setRange([clicked]);
    } else {
      setRange(null);
    }
  }, [loading, bookedSet, arrivalSet, today, maxFuture]);

  return (
    <section id="availability" className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <h3 className="text-2xl md:text-3xl font-bold mb-6 text-center">
          Calendrier &amp; réservation
        </h3>

        {error && (
          <p className="text-red-500 text-center mb-2">
            Erreur lors du chargement des disponibilités : {error}
          </p>
        )}

        <div className="flex justify-center mb-6">
          <div className="w-full max-w-md relative">
            {loading && (
              <div className="absolute top-2 left-0 right-0 z-10 flex justify-center">
                <div className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full shadow-md animate-pulse">
                  Chargement…
                </div>
              </div>
            )}

            <Calendar
              className="mx-auto w-full"
              tileDisabled={tileDisabled}
              tileClassName={tileClassName}
              selectRange={true}
              locale="fr-FR"
              onChange={handleCalendarChange}
              value={range as any}
            />
          </div>
        </div>

        {range && nights > 0 && nights < 2 && isInJulyOrAugust(range) && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-300 rounded-md text-center">
            <p className="text-sm font-semibold text-orange-700">
              ⚠️ Attention : Pour les séjours en juillet et août, la réservation minimum est de 2 nuits.
            </p>
          </div>
        )}

        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md text-center">
          <p className="text-sm font-medium text-blue-800">
            Sélectionnez vos dates d&apos;arrivée et de départ sur le calendrier.
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>◾️◾️ <strong>Cases grises</strong> : nuits non disponibles.</p>
            <p>
              ◾️◽️<strong>Cases moitié grises</strong> : Checkout à 12h.
            </p>
          </div>
        </div>

        <form className="bg-gray-50 p-6 rounded-md shadow-sm" onSubmit={(e) => e.preventDefault()}>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date d&apos;arrivée</label>
              <input
                readOnly
                value={range && range.length === 2 ? formatDate(range[0]) : ''}
                placeholder="Sélectionnez sur le calendrier"
                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date de départ</label>
              <input
                readOnly
                value={range && range.length === 2 ? formatDate(range[1]) : ''}
                placeholder="Sélectionnez sur le calendrier"
                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prix total</label>
              <input
                readOnly
                value={nights > 0 ? finalPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—'}
                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prénom</label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Téléphone</label>
              <input
                type="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Adresse mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>

          {formError && <p className="mt-4 text-red-500">{formError}</p>}

          {!isFormValid && nights > 0 && (
            <p className="mt-4 text-orange-600 text-sm font-medium">
              ⚠️ Merci de remplir toutes vos informations (nom, prénom, email, téléphone et de valider le règlement) avant de procéder au paiement.
            </p>
          )}

          <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <input
              id="rules-accepted"
              type="checkbox"
              checked={isRulesAccepted}
              onChange={(e) => setIsRulesAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-600"
            />
            <label htmlFor="rules-accepted" className="text-sm text-gray-800">
              J&apos;ai lu et j&apos;accepte le{' '}
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="font-semibold text-blue-600 underline hover:text-blue-800"
              >
                règlement intérieur *
              </button>
            </label>
          </div>

          {(() => {
            const AIRBNB_LINK = 'https://www.airbnb.fr/rooms/746228202767512240?guests=1&adults=1&s=67&unique_share_id=d62985eb-ed51-4f76-98c3-fa9363f1486b';
            const airbnbApproxPrice = Math.round(finalPrice * 1.2 * 100) / 100;
            const airbnbPriceStr = airbnbApproxPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

            return (
              <div className="mt-8 space-y-8">
                {/* Option 1: Direct (PayPal/Carte) */}
                <div className="w-full">
                  <div className="text-center mb-4">
                    <p className="text-sm font-bold text-gray-800">💳 Paiement sécurisé par Carte Bancaire ou PayPal</p>
                    <p className="text-xs text-gray-500">Réservation immédiate</p>
                  </div>

                  <PayPalScriptProvider options={{ "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID, currency: "EUR" }}>
                    <div className="w-full flex justify-center">
                      <div className={`${!isFormValid ? 'opacity-50 pointer-events-none' : ''}`}>
                        <PayPalButtons
                          style={{ layout: "vertical", color: "blue", shape: "rect", label: "paypal" }}
                          disabled={!isFormValid || nights === 0}
                          forceReRender={[finalPrice]}
                          createOrder={(data, actions) => {
                            if (!isFormValid) return Promise.reject();
                            return actions.order.create({
                              purchase_units: [{
                                amount: {
                                  value: finalPrice.toFixed(2),
                                  currency_code: "EUR"
                                },
                                description: `Séjour The Tiny Home - ${nights} nuit(s)`,
                              }],
                              intent: 'CAPTURE'
                            });
                          }}
                          onApprove={async (data, actions) => {
                            if (!actions) return;
                            try {
                              await actions.order!.capture();
                              const normalizedRange = Array.isArray(range) && range.length === 2
                                ? [dateToYMD(range[0]), dateToYMD(range[1])]
                                : range;

                              const response = await fetch(`${API_BASE_URL}/api/paypal/complete`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  orderId: data.orderID,
                                  reservationData: { nom, prenom, tel, email, range: normalizedRange, nights, finalPrice }
                                }),
                              });

                              const json = await response.json();
                              if (response.ok && json.success)
                                alert(`Paiement confirmé ! Un mail de confirmation vous a été envoyé.`);
                              else
                                alert(`Erreur : ${json.message}`);
                            } catch (err) {
                              alert('Erreur lors du traitement du paiement.');
                            }
                          }}
                        />
                      </div>
                    </div>
                  </PayPalScriptProvider>
                </div>

                {/* Séparateur */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase">Ou</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                {/* Option 2 & 3: Airbnb et Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-center text-xs font-medium text-gray-600">Réserver via la plateforme</p>
                    <a
                      href={isFormValid ? AIRBNB_LINK : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!isFormValid) {
                          e.preventDefault();
                          alert('Merci de remplir toutes vos informations avant de réserver sur Airbnb.');
                        }
                      }}
                      className={`block text-white text-center py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg ${
                        !isFormValid ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      style={{ backgroundColor: '#FF5A5F' }}
                    >
                      🎒 Réserver sur Airbnb
                      <span className="block text-xs font-normal mt-1">≈ {airbnbPriceStr} (frais inclus)</span>
                    </a>
                  </div>

                  <div className="space-y-2">
                    <p className="text-center text-xs font-medium text-gray-600">Une question ? Une demande spéciale ?</p>
                    <button
                      type="button"
                      onClick={openMailClient}
                      className="w-full bg-green-600 text-white text-center py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      ✉️ Nous contacter par Email
                    </button>
                  </div>
                </div>

                {/* Détails du séjour */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-2">📊 Détails du séjour :</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <span>Prix/nuit : <strong>{displayedPricePerNight.toLocaleString('fr-FR')}€</strong></span>
                      <span>Nuits : <strong>{nights}</strong></span>
                      {discountPercent > 0 && (
                        <span>Remise : <strong>{discountPercent}%</strong></span>
                      )}
                    </div>
                    {nights > 0 && (
                      <p className="mt-2 text-xs text-yellow-800 font-medium">
                        ℹ️ * Le tarif affiché sur Airbnb est à titre indicatif incluant les frais de la plateforme.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </form>
      </div>

      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white max-w-lg w-full mx-4 rounded-lg shadow-lg p-6 relative">
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
              aria-label="Fermer"
            >
              ×
            </button>
            <h4 className="text-lg font-semibold mb-4">Règlement intérieur</h4>
            <div className="max-h-80 overflow-y-auto text-sm text-gray-700 space-y-3">
              <p className="font-semibold">⚠️ RÈGLEMENT INTÉRIEUR</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Aucune fête ni événement n'est autorisé.</li>
                <li>Merci de respecter le calme après 22h.</li>
                <li>Aucune personne extérieure non prévue n'est autorisée.</li>
                <li>La vaisselle doit être propre et rangée à votre départ.</li>
                <li>Merci de retirer vos chaussures à l'intérieur.</li>
                <li>Il est strictement interdit de fumer à l'intérieur.</li>
                <li>Les animaux de compagnie ne sont pas admis.</li>
              </ul>
              <p className="pt-2">❤️ Merci pour votre compréhension.</p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
