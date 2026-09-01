/**
 * Fictional demo workspace: RecycLéman SA, Yverdon-les-Bains (VD).
 * Every company, person, plate and price below is invented. Prices are DEMO values and
 * must not be read as market quotations.
 */
import type { MaterialCategory, PriceUnit } from "./schema";

export const DEMO_ORGANIZATION = {
  name: "RecycLéman SA",
  legalName: "RecycLéman SA",
  street: "Chemin des Aciéries 14",
  postalCode: "1400",
  city: "Yverdon-les-Bains",
  canton: "VD",
  vatNumber: "CHE-123.456.789 TVA",
  phone: "+41 24 555 01 20",
  email: "exploitation@recycleman.example",
  ticketPrefix: "P",
};

export const DEMO_YARD = {
  name: "Site d'Yverdon",
  code: "YVD",
};

export interface DemoMaterial {
  code: string;
  name: string;
  category: MaterialCategory;
  priceUnit: PriceUnit;
  /** Current DEMO purchase price, centimes per tonne. */
  priceCtsPerT: number;
  /** Typical net load per delivery, in kg. */
  typicalNetKg: [number, number];
  /** Opening stock 30 days ago, in kg. */
  openingStockKg: number;
}

export const DEMO_MATERIALS: DemoMaterial[] = [
  {
    code: "CU-MIL",
    name: "Cuivre Millberry",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 740_000,
    typicalNetKg: [80, 600],
    openingStockKg: 1_200,
  },
  {
    code: "CU-MIX",
    name: "Cuivre mêlé",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 615_000,
    typicalNetKg: [150, 1_500],
    openingStockKg: 3_400,
  },
  {
    code: "LAI",
    name: "Laiton",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 420_000,
    typicalNetKg: [100, 900],
    openingStockKg: 1_900,
  },
  {
    code: "AL-PRO",
    name: "Aluminium propre",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 145_000,
    typicalNetKg: [200, 1_800],
    openingStockKg: 4_200,
  },
  {
    code: "AL-PRF",
    name: "Profilés aluminium",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 130_000,
    typicalNetKg: [300, 2_500],
    openingStockKg: 3_100,
  },
  {
    code: "INOX",
    name: "Inox 304",
    category: "stainless",
    priceUnit: "kg",
    priceCtsPerT: 110_000,
    typicalNetKg: [150, 1_600],
    openingStockKg: 2_600,
  },
  {
    code: "FER",
    name: "Ferraille (acier)",
    category: "ferrous",
    priceUnit: "t",
    priceCtsPerT: 18_500,
    typicalNetKg: [1_500, 9_000],
    openingStockKg: 38_000,
  },
  {
    code: "FONTE",
    name: "Fonte",
    category: "ferrous",
    priceUnit: "t",
    priceCtsPerT: 21_000,
    typicalNetKg: [800, 4_000],
    openingStockKg: 6_500,
  },
  {
    code: "PB",
    name: "Plomb",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 135_000,
    typicalNetKg: [100, 800],
    openingStockKg: 900,
  },
  {
    code: "ZN",
    name: "Zinc",
    category: "non_ferrous",
    priceUnit: "kg",
    priceCtsPerT: 180_000,
    typicalNetKg: [80, 500],
    openingStockKg: 450,
  },
  {
    code: "CAB",
    name: "Câbles isolés",
    category: "cables",
    priceUnit: "kg",
    priceCtsPerT: 260_000,
    typicalNetKg: [150, 1_200],
    openingStockKg: 2_800,
  },
  {
    code: "MOT",
    name: "Moteurs électriques",
    category: "other",
    priceUnit: "kg",
    priceCtsPerT: 55_000,
    typicalNetKg: [200, 1_500],
    openingStockKg: 1_600,
  },
];

export interface DemoVehicle {
  plate: string;
  description: string;
  tareKg: number;
  maxPayloadKg: number;
}

export interface DemoSupplier {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  canton: string;
  vatNumber: string;
  notes: string;
  /** Relative frequency of deliveries. */
  frequency: number;
  vehicles: DemoVehicle[];
  /** Relative likelihood per material code. */
  materialWeights: Record<string, number>;
}

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    name: "Construction Favre SA",
    contactName: "Laurent Favre",
    email: "chantiers@favre-construction.example",
    phone: "+41 21 555 12 40",
    street: "Route de Berne 112",
    postalCode: "1010",
    city: "Lausanne",
    canton: "VD",
    vatNumber: "CHE-234.567.890 TVA",
    notes: "Chantiers de démolition et rénovation. Livraisons surtout le matin.",
    frequency: 5,
    vehicles: [
      {
        plate: "VD 123 456",
        description: "Camion benne 3 essieux",
        tareKg: 12_400,
        maxPayloadKg: 13_000,
      },
      { plate: "VD 234 567", description: "Camionnette", tareKg: 2_350, maxPayloadKg: 1_100 },
    ],
    materialWeights: { FER: 5, "AL-PRF": 2, "CU-MIX": 1, INOX: 1, FONTE: 1 },
  },
  {
    name: "Démolition Rochat Sàrl",
    contactName: "Sandra Rochat",
    email: "info@rochat-demolition.example",
    phone: "+41 24 555 33 18",
    street: "Rue de l'Industrie 7",
    postalCode: "1400",
    city: "Yverdon-les-Bains",
    canton: "VD",
    vatNumber: "CHE-345.678.901 TVA",
    notes: "",
    frequency: 6,
    vehicles: [
      { plate: "VD 345 678", description: "Camion multibenne", tareKg: 9_800, maxPayloadKg: 8_200 },
      { plate: "VD 356 789", description: "Semi-remorque", tareKg: 15_600, maxPayloadKg: 24_000 },
    ],
    materialWeights: { FER: 6, FONTE: 2, "CU-MIX": 1, "AL-PRF": 2, INOX: 1 },
  },
  {
    name: "Électricité Bovet SA",
    contactName: "Marc Bovet",
    email: "atelier@bovet-electricite.example",
    phone: "+41 32 555 21 07",
    street: "Rue des Draizes 3",
    postalCode: "2000",
    city: "Neuchâtel",
    canton: "NE",
    vatNumber: "CHE-456.789.012 TVA",
    notes: "Apporte régulièrement des chutes de câbles et du cuivre dénudé.",
    frequency: 5,
    vehicles: [{ plate: "NE 45 678", description: "Fourgon", tareKg: 2_480, maxPayloadKg: 1_200 }],
    materialWeights: { "CU-MIL": 3, "CU-MIX": 4, CAB: 4, MOT: 1 },
  },
  {
    name: "Garage du Léman Sàrl",
    contactName: "Pierre-Alain Meyer",
    email: "contact@garage-leman.example",
    phone: "+41 21 555 78 22",
    street: "Avenue de Gilamont 40",
    postalCode: "1800",
    city: "Vevey",
    canton: "VD",
    vatNumber: "CHE-567.890.123 TVA",
    notes: "Jantes alu, batteries et pièces mécaniques.",
    frequency: 3,
    vehicles: [
      {
        plate: "VD 456 789",
        description: "Pick-up avec remorque",
        tareKg: 3_150,
        maxPayloadKg: 1_800,
      },
    ],
    materialWeights: { FER: 2, "AL-PRO": 3, PB: 2, MOT: 1 },
  },
  {
    name: "Ferblanterie Monnier",
    contactName: "Julie Monnier",
    email: "julie@monnier-ferblanterie.example",
    phone: "+41 26 555 40 61",
    street: "Rue de Lausanne 25",
    postalCode: "1530",
    city: "Payerne",
    canton: "VD",
    vatNumber: "",
    notes: "Entreprise individuelle. Paiement comptant souhaité.",
    frequency: 3,
    vehicles: [
      { plate: "VD 567 890", description: "Camionnette", tareKg: 2_210, maxPayloadKg: 1_000 },
    ],
    materialWeights: { ZN: 4, "CU-MIL": 2, "AL-PRO": 2, INOX: 1 },
  },
  {
    name: "Chauffage Sanitaire Duc SA",
    contactName: "Olivier Duc",
    email: "depot@duc-chauffage.example",
    phone: "+41 26 555 15 90",
    street: "Route de la Glâne 88",
    postalCode: "1700",
    city: "Fribourg",
    canton: "FR",
    vatNumber: "CHE-678.901.234 TVA",
    notes: "",
    frequency: 4,
    vehicles: [
      { plate: "FR 123 456", description: "Fourgon", tareKg: 2_520, maxPayloadKg: 1_300 },
      { plate: "FR 234 567", description: "Camion 2 essieux", tareKg: 6_900, maxPayloadKg: 5_600 },
    ],
    materialWeights: { "CU-MIX": 4, LAI: 4, FONTE: 2, INOX: 1 },
  },
  {
    name: "Câblerie Jurassienne SA",
    contactName: "Nadia Chételat",
    email: "logistique@cablerie-ju.example",
    phone: "+41 32 555 62 33",
    street: "Rue de la Communance 12",
    postalCode: "2800",
    city: "Delémont",
    canton: "JU",
    vatNumber: "CHE-789.012.345 TVA",
    notes: "Chutes de production. Livraisons planifiées le mardi.",
    frequency: 3,
    vehicles: [
      { plate: "JU 12 345", description: "Camion 2 essieux", tareKg: 7_100, maxPayloadKg: 5_400 },
    ],
    materialWeights: { CAB: 6, "CU-MIL": 3 },
  },
  {
    name: "Menuiserie Métallique Gilliéron SA",
    contactName: "Étienne Gilliéron",
    email: "info@gillieron-metal.example",
    phone: "+41 21 555 09 74",
    street: "Chemin de la Vulliette 8",
    postalCode: "1110",
    city: "Morges",
    canton: "VD",
    vatNumber: "CHE-890.123.456 TVA",
    notes: "",
    frequency: 4,
    vehicles: [
      {
        plate: "VD 678 901",
        description: "Camionnette plateau",
        tareKg: 2_740,
        maxPayloadKg: 1_400,
      },
    ],
    materialWeights: { "AL-PRF": 5, INOX: 3, FER: 2 },
  },
  {
    name: "Ville d'Yverdon-les-Bains – Voirie",
    contactName: "Service des travaux",
    email: "voirie@yverdon.example",
    phone: "+41 24 555 70 00",
    street: "Rue des Moulins 14",
    postalCode: "1400",
    city: "Yverdon-les-Bains",
    canton: "VD",
    vatNumber: "",
    notes: "Collectivité publique. Bon de livraison obligatoire.",
    frequency: 2,
    vehicles: [
      {
        plate: "VD 789 012",
        description: "Camion benne communal",
        tareKg: 8_600,
        maxPayloadKg: 6_000,
      },
    ],
    materialWeights: { FER: 3, "AL-PRO": 1, MOT: 1, FONTE: 1 },
  },
  {
    name: "Transports Berset SA",
    contactName: "Christophe Berset",
    email: "dispo@berset-transports.example",
    phone: "+41 26 555 28 41",
    street: "Route de Riaz 51",
    postalCode: "1630",
    city: "Bulle",
    canton: "FR",
    vatNumber: "CHE-901.234.567 TVA",
    notes: "Transporte pour le compte de tiers.",
    frequency: 3,
    vehicles: [
      { plate: "FR 345 678", description: "Semi-remorque", tareKg: 14_900, maxPayloadKg: 25_000 },
    ],
    materialWeights: { FER: 4, "AL-PRF": 1, PB: 1 },
  },
  {
    name: "Atelier Perrin",
    contactName: "Michel Perrin",
    email: "m.perrin@atelier-perrin.example",
    phone: "+41 24 555 84 12",
    street: "Rue Neuve 9",
    postalCode: "1450",
    city: "Sainte-Croix",
    canton: "VD",
    vatNumber: "",
    notes: "Mécanique de précision : copeaux et chutes.",
    frequency: 2,
    vehicles: [
      { plate: "VD 890 123", description: "Break avec remorque", tareKg: 2_050, maxPayloadKg: 700 },
    ],
    materialWeights: { LAI: 3, INOX: 3, "CU-MIL": 1 },
  },
  {
    name: "Récupération Martin & Fils",
    contactName: "Daniel Martin",
    email: "martin.recup@example.ch",
    phone: "+41 24 555 47 19",
    street: "Chemin du Suchet 3",
    postalCode: "1350",
    city: "Orbe",
    canton: "VD",
    vatNumber: "CHE-012.345.678 TVA",
    notes: "Collecteur indépendant, charges mixtes.",
    frequency: 4,
    vehicles: [
      { plate: "VD 901 234", description: "Camion plateau", tareKg: 5_900, maxPayloadKg: 4_500 },
      { plate: "VD 912 345", description: "Fourgon", tareKg: 2_390, maxPayloadKg: 1_200 },
    ],
    materialWeights: { "CU-MIX": 3, LAI: 2, "AL-PRO": 2, CAB: 2, MOT: 2, FER: 2 },
  },
];

export interface DemoDispatch {
  materialCode: string;
  daysAgo: number;
  /** Share of the stock on hand that leaves the yard. */
  share: number;
  destination: string;
}

/** Outbound shipments to (fictional) smelters and processors. */
export const DEMO_DISPATCHES: DemoDispatch[] = [
  { materialCode: "FER", daysAgo: 17, share: 0.4, destination: "Aciérie Romande SA, Vallorbe" },
  { materialCode: "CU-MIX", daysAgo: 15, share: 0.45, destination: "Fonderie du Rhône SA, Sion" },
  {
    materialCode: "AL-PRF",
    daysAgo: 12,
    share: 0.5,
    destination: "Alu Recyclage Valais SA, Sierre",
  },
  { materialCode: "FER", daysAgo: 10, share: 0.35, destination: "Aciérie Romande SA, Vallorbe" },
  {
    materialCode: "CAB",
    daysAgo: 9,
    share: 0.45,
    destination: "Granulation Câbles Suisse, Bienne",
  },
  { materialCode: "INOX", daysAgo: 8, share: 0.4, destination: "Fonderie du Rhône SA, Sion" },
  { materialCode: "FONTE", daysAgo: 6, share: 0.45, destination: "Aciérie Romande SA, Vallorbe" },
  { materialCode: "FER", daysAgo: 3, share: 0.4, destination: "Aciérie Romande SA, Vallorbe" },
  {
    materialCode: "AL-PRO",
    daysAgo: 2,
    share: 0.35,
    destination: "Alu Recyclage Valais SA, Sierre",
  },
  { materialCode: "CU-MIL", daysAgo: 1, share: 0.45, destination: "Fonderie du Rhône SA, Sion" },
  { materialCode: "FER", daysAgo: 0, share: 0.25, destination: "Aciérie Romande SA, Vallorbe" },
];

export const DEMO_TICKET_NOTES = [
  "",
  "",
  "",
  "",
  "Chargement propre, sans corps étrangers.",
  "Présence de quelques éléments composites, prix ajusté.",
  "Bon de livraison fournisseur joint.",
  "Déchargement à la grue.",
  "Fournisseur régulier, prix convenu par téléphone.",
  "",
];

export const DEMO_CANCEL_NOTES = [
  "Chargement refusé : matière non conforme (présence d'amiante suspectée).",
  "Pesée annulée à la demande du chauffeur, retour du chargement.",
];
