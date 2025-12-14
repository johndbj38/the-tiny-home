import React, { useState } from 'react';
import {
  Bath,
  Twitch as Kitchen,
  Bed,
  Trees,
  Thermometer,
  Bike,
  UtensilsCrossed,
  Store,
  Car,
  Mountain
} from 'lucide-react';

const Features = () => {
  const [showEquipment, setShowEquipment] = useState(false);

  const features = [
    {
      icon: <Bath className="w-8 h-8 text-green-600" />,
      title: 'Jacuzzi Privé',
      description:
        "Profitez d'un bain à remous toute l'année avec vue sur la nature. Peignoirs et chaussons fournis.",
    },
    {
      icon: <Kitchen className="w-8 h-8 text-green-600" />,
      title: 'Cuisine Équipée',
      description: (
        <div>
          <p>Tout le nécessaire pour préparer de bons petits plats</p>
          <button
            onClick={() => setShowEquipment(!showEquipment)}
            className="text-green-600 underline mt-2"
          >
            Voir les équipements
          </button>
          {showEquipment && (
            <ul className="mt-2 text-gray-600 list-disc pl-5">
              <li>Four + Micro-ondes</li>
              <li>Appareil à raclette (2 personnes)</li>
              <li>Cafetière Senseo (*Quelques dosettes seront fournies)</li>
              <li>Bouilloire</li>
              <li>Poêles et casseroles</li>
              <li>Flûtes à Champagne</li>
              <li>Verres / Tasses</li>
              <li>Couverts</li>
            </ul>
          )}
        </div>
      ),
    },
    {
      icon: <Bed className="w-8 h-8 text-green-600" />,
      title: 'Coin Nuit Cosy',
      description: 'Un lit Queen size pour des nuits paisibles',
    },
    {
      icon: <Car className="w-8 h-8 text-green-600" />,
      title: 'Place de Parking Privée',
      description: 'Place de parking privée gratuite sur place',
    },
    {
      icon: <Thermometer className="w-8 h-8 text-green-600" />,
      title: 'Climatisation',
      description: 'Confort optimal en toute saison',
    },
    {
      icon: <Mountain className="w-8 h-8 text-green-600" />,
      title: 'Vue Montagne',
      description: 'Vue imprenable sur la Dent du Chat',
    },
    {
      icon: <Bike className="w-8 h-8 text-green-600" />,
      title: 'Activités',
      description: (
        <div>
          <p>Pistes cyclables et sentiers de randonnée à proximité.</p>
          <a
            href="https://www.visorando.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 underline hover:text-green-700"
          >
            Voir les randonnées
          </a>
          <br />
          <a
            href="https://www.lebourgetdulac.fr/pistes-cyclables/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 underline hover:text-green-700"
          >
            Voir les pistes cyclables
          </a>
          <br />
          <a
            href="https://www.aixlesbains-rivieradesalpes.com/idees-de-balades/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 underline hover:text-green-700"
          >
            Découvrir les balades nature
          </a>
        </div>
      ),
    },
    {
      icon: <UtensilsCrossed className="w-8 h-8 text-green-600" />,
      title: 'Restaurants',
      description: (
        <div>
          <p className="mb-2">À 10 minutes à pied de la Tiny Home :</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>La Trattoria à Voglans</strong> - Cuisine italienne
              authentique.
              Ouvert du mardi au Samedi. 
              <br />
              <a
                href="https://trattoria-voglans.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline hover:text-green-700"
              >
                Site web
              </a>
            </li>
            <li>
              <strong>La Française</strong> - Brasserie traditionnelle.
              <br />
              Ouvert du lundi au vendredi 7h00 à 20h, Samedi fermé, Dimanche
              9h00 à 15h.
              <br />
              <a
                href="https://lafrancaise.eatbu.com/?lang=fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline hover:text-green-700"
              >
                Site web
              </a>
            </li>
          </ul>
          <p className="mt-4">
            <a
              href="https://www.tripadvisor.fr/Restaurants-g230055-Voglans_Savoie_Auvergne_Rhone_Alpes.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 underline hover:text-green-700"
            >
              Voir tous les restaurants aux alentours
            </a>
          </p>
        </div>
      ),
    },
    {
      icon: <Store className="w-8 h-8 text-green-600" />,
      title: 'Commerces',
      description: (
        <div>
          <p className="mb-2">À 10 minutes à pied de la Tiny Home :</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>La Gourmandise • Boulangerie Pâtisserie</strong> - Une
              boulangerie artisanale pour vos petits déjeuners et goûters.
              <br />
              Horaires :
              <ul className="list-disc pl-5 mt-2">
                <li>Lundi : Fermé</li>
                <li>Mardi : 06h30 - 12h45 / 15h30 - 19h00</li>
                <li>Mercredi : 06h30 - 12h45</li>
                <li>Jeudi : 06h30 - 12h45 / 15h30 - 19h00</li>
                <li>Vendredi : 06h30 - 12h45 / 15h30 - 19h00</li>
                <li>Samedi : 06h30 - 12h45 / 15h30 - 19h00</li>
                <li>Dimanche : 06h30 - 12h30</li>
              </ul>
              <br />
              <a
                href="https://www.google.com/maps/place/La+Gourmandise+%E2%80%A2+Boulangerie+P%C3%A2tisserie/@45.6314713,5.8959808,19z/data=!4m9!1m2!2m1!1sla+tratoria+voglans!3m5!1s0x478ba7378305f9d5:0x96fbd38340fe880!8m2!3d45.6318381!4d5.8972195!16s%2Fg%2F11h07dz47f?entry=ttu&g_ep=EgoyMDI1MDIxMC4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline hover:text-green-700"
              >
                Voir sur Google Maps
              </a>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div id="features" className="bg-gray-50 py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">
          Une Expérience Unique
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                {feature.icon}
                <div>
                  <h3 className="font-semibold text-lg text-green-600">
                    {feature.title}
                  </h3>
                  <div className="text-gray-600">{feature.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Features;