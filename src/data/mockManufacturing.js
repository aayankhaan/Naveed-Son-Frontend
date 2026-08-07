// Legacy mocks still used by Orders / Daily Entry until those pages are wired to the API.
// Costing loads Articles & Sets from /api/articles and /api/sets.
import { articleToLegacy } from "../lib/manufacturingPricing";

export const MOCK_EMPLOYEES = [
  { e_id: 1, full_name: "Fahad Iqbal", station: "Stitching", image_link: "" },
  { e_id: 2, full_name: "Bilal Hussain", station: "Cutting", image_link: "" },
  { e_id: 3, full_name: "Sana Tariq", station: "Checking", image_link: "" },
  { e_id: 4, full_name: "Ayesha Noor", station: "Packing", image_link: "" },
];

/** Standalone catalog articles (not linked to sets) */
export const ARTICLES = [
  {
    id: "ART-PILLOW-COVER",
    name: "Pillow Cover",
    description: "Standard pillow cover with optional button or pocket",
    sellingPrice: 100,
    cuttingRate: 2,
    stitchingRate: 5,
    checkingRate: 1,
    packingRate: 1,
    measurements: [
      { id: "MEASURE-STANDARD", name: "Standard (50 × 75)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
      { id: "MEASURE-KING", name: "King (60 × 90)", sellingPrice: 140, cuttingRate: null, stitchingRate: 8, checkingRate: null, packingRate: null },
    ],
    tags: [],
    addons: [
      { id: "ADDON-BUTTON", name: "Button", sellingPrice: 20, cuttingRate: null, stitchingRate: 5, checkingRate: null, packingRate: null },
      { id: "ADDON-POCKET", name: "Pocket", sellingPrice: 35, cuttingRate: null, stitchingRate: 8, checkingRate: null, packingRate: null },
    ],
  },
  {
    id: "ART-DUVET-COVER",
    name: "Duvet Cover",
    description: "Premium cotton duvet cover",
    sellingPrice: 1200,
    cuttingRate: 5,
    stitchingRate: 15,
    checkingRate: 3,
    packingRate: 2,
    measurements: [
      { id: "MEASURE-SINGLE", name: "Single (140 × 200)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
      { id: "MEASURE-DOUBLE", name: "Double (200 × 220)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
      { id: "MEASURE-KING", name: "King (108 × 108)", sellingPrice: 1100, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
    ],
    tags: [],
    addons: [
      { id: "ADDON-BUTTON", name: "Button", sellingPrice: 30, cuttingRate: null, stitchingRate: 5, checkingRate: null, packingRate: null },
      { id: "ADDON-POCKET", name: "Pocket", sellingPrice: 40, cuttingRate: null, stitchingRate: 10, checkingRate: null, packingRate: null },
    ],
  },
  {
    id: "ART-BEDSHEET",
    name: "Bedsheet",
    description: "Premium cotton bedsheet",
    sellingPrice: 850,
    cuttingRate: 2.5,
    stitchingRate: 5,
    checkingRate: 1.5,
    packingRate: 1,
    measurements: [
      { id: "MEASURE-SINGLE", name: "Single (90 × 100)", sellingPrice: 800, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
      { id: "MEASURE-DOUBLE", name: "Double (140 × 200)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
      { id: "MEASURE-KING", name: "King (108 × 108)", sellingPrice: 950, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
    ],
    tags: [],
    addons: [
      { id: "ADDON-LACE", name: "Lace Border", sellingPrice: 50, cuttingRate: null, stitchingRate: 12, checkingRate: null, packingRate: null },
    ],
  },
];

/** Sets own their child articles — not linked to the catalog */
export const SETS = [
  {
    id: "SET-1",
    name: "Duvet Set",
    description: "Complete duvet set with cover, pillow covers, and filling",
    articles: [
      {
        id: "SA-DUVET",
        name: "Duvet Cover",
        description: "",
        sellingPrice: 1200,
        cuttingRate: 5,
        stitchingRate: 15,
        checkingRate: 3,
        packingRate: 2,
        measurements: [
          { id: "M-DUVET-SINGLE", name: "Single (140 × 200)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
          { id: "M-DUVET-DOUBLE", name: "Double (200 × 220)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
        ],
        addons: [
          { id: "A-BUTTON", name: "Button", sellingPrice: 30, cuttingRate: null, stitchingRate: 5, checkingRate: null, packingRate: null },
          { id: "A-POCKET", name: "Pocket", sellingPrice: 40, cuttingRate: null, stitchingRate: 10, checkingRate: null, packingRate: null },
        ],
      },
      {
        id: "SA-PILLOW",
        name: "Pillow Cover",
        description: "",
        sellingPrice: 100,
        cuttingRate: 2,
        stitchingRate: 5,
        checkingRate: 1,
        packingRate: 1,
        measurements: [
          { id: "M-PILLOW-STD", name: "Standard (50 × 75)", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
        ],
        addons: [
          { id: "A-BUTTON", name: "Button", sellingPrice: 20, cuttingRate: null, stitchingRate: 5, checkingRate: null, packingRate: null },
        ],
      },
      {
        id: "SA-FILLING",
        name: "Filling",
        description: "",
        sellingPrice: 500,
        cuttingRate: 0,
        stitchingRate: 0,
        checkingRate: 2,
        packingRate: 3,
        measurements: [
          { id: "M-FILL-SINGLE", name: "Single", sellingPrice: 500, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
          { id: "M-FILL-DOUBLE", name: "Double", sellingPrice: 650, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null },
        ],
        addons: [],
      },
    ],
    configurations: [
      {
        id: "CONFIG-SINGLE",
        name: "Single",
        setSellingPrice: 1800,
        parts: [
          { setArticleId: "SA-DUVET", measurementId: "M-DUVET-SINGLE", quantityPerSet: 1, fillingRequirement: "", defaultAddonIds: [] },
          { setArticleId: "SA-PILLOW", measurementId: "M-PILLOW-STD", quantityPerSet: 1, fillingRequirement: "", defaultAddonIds: [] },
          { setArticleId: "SA-FILLING", measurementId: "M-FILL-SINGLE", quantityPerSet: 1, fillingRequirement: "1 Single Filling", defaultAddonIds: [] },
        ],
      },
      {
        id: "CONFIG-DOUBLE",
        name: "Double",
        setSellingPrice: 2450,
        parts: [
          { setArticleId: "SA-DUVET", measurementId: "M-DUVET-DOUBLE", quantityPerSet: 1, fillingRequirement: "", defaultAddonIds: [] },
          { setArticleId: "SA-PILLOW", measurementId: "M-PILLOW-STD", quantityPerSet: 2, fillingRequirement: "", defaultAddonIds: [] },
          { setArticleId: "SA-FILLING", measurementId: "M-FILL-DOUBLE", quantityPerSet: 1, fillingRequirement: "1 Double Filling", defaultAddonIds: [] },
        ],
      },
    ],
  },
];

export const MOCK_ORDERS = [
  {
    order_id: 1,
    atm_no: "ATM-001",
    customer: "ABC Textiles",
    order_date: "2026-08-01",
    notes: "Priority dispatch",
    bill_no: null,
    lines: [{
      order_line_id: 1,
      article_id: "BEDSHEET",
      article_name: "Bedsheet",
      size_id: null,
      size_name: null,
      dimension_id: "MEASURE-KING",
      dimension_name: "King (108 × 108)",
      pack_per_ctn: 10,
      quantity: 1000,
      net_weight: 12,
      gross_weight: 13,
      carton_size: "24 × 18 × 12",
      cbm: 0.085,
      variants: [
        { variant_id: 101, variant_name: "Sunflower", quantity: 600, ready_quantity: 150 },
        { variant_id: 102, variant_name: "Plain White", quantity: 400, ready_quantity: 0 },
      ],
    }],
  },
];

export const MOCK_ARTICLES = ARTICLES.map(articleToLegacy);
