// Every piece of product copy lives here, with where it came from.
// "site" = verbatim or near-verbatim from mochaev.com (Sept 2026).
// "story" = cinematic scene copy written for this redesign (no factual claims).

export const LINKS = {
  app: 'https://app.mochaev.com/', // Get Help Now / Become a Provider / Sign In (site)
  powerbridgePage: 'https://www.mochaev.com/powerbridgepro.html',
  powerbridgeOffer: 'https://roamenergy.tech/discount/MOCHA?redirect=%2Fproducts%2Fpowerbridge-pro-gen2',
  powerbridgeCompat:
    'https://cdn.shopify.com/s/files/1/0942/3903/1613/files/RoamEnergy_Non_Tesla_EV_Compatibility_Validation_List.pdf?v=1778004042',
  privacy: 'https://www.mochaev.com/privacy.html',
  contact: 'mailto:support@mochaev.com',
  linkedin: 'https://linkedin.com/company/mochaev',
  facebook: 'https://www.facebook.com/profile.php?id=61575364122940',
  instagram: 'https://www.instagram.com/mocha_ev',
  x: 'https://x.com/mocha_ev',
};

export const LOGO = 'https://www.mochaev.com/mocha-logo-transp_500x.0010035e.webp';

export const SITE = {
  h1: 'Emergency EV charging when you need it most.', // site
  lede: 'Mocha gets you back on the road quickly by bringing a mobile charger to you.', // site
  driverTitle: 'I Need a Charge', // site
  driverBody: 'Stranded with a depleted battery? Find help nearby.', // site
  driverCta: 'Get Help Now', // site
  providerTitle: "I'm a Charge Provider", // site
  providerBody: 'Earn money helping fellow EV owners by offering emergency charging.', // site
  providerCta: 'Become a Provider', // site
  steps: [
    // site: "How Mocha Works"
    { title: 'Sign Up', body: 'Create an account as someone who needs help or can provide it.' },
    { title: 'Connect', body: 'Our platform matches those in need with nearby providers.' },
    { title: 'Get Charged', body: 'Receive emergency charging and get back on the road quickly.' },
  ],
  coverageTitle: 'Nationwide coverage', // site
  coverageBody:
    'Mobile EV charging is available through our growing network of service providers across the continental United States.', // site
  noTow: 'No waiting for a tow truck, just convenient charging where you need it.', // Mocha's own launch post
  footerTag: 'Emergency charging for electric vehicles.', // site
};

export const POWERBRIDGE = {
  offer: 'Additional 10% off for Mocha users', // site
  title: 'EV = Backup Power', // site
  body:
    "Mocha partners with RoamEnergy to unlock your EV's giant battery for clean, quiet backup power.", // site
  taps: 'PowerBridge Pro taps into CCS1 and NACS vehicles for access to flexible power.', // site
  uses: [
    // site: "Ultimate Flexibility"
    { key: 'ev', title: 'Charge stranded EV', body: 'Help other drivers get back on the road.' },
    { key: 'home', title: 'Keep the lights on', body: 'Power your fridge, Wi‑Fi, lights, and other home essentials through an outage.' },
    { key: 'out', title: 'Outdoors', body: 'Start the day off-grid.' },
    { key: 'job', title: 'Construction site', body: 'Keep your tools charged.' },
  ],
  compat:
    'PowerBridge Pro is made by RoamEnergy, not Mocha. It works with Tesla and validated CCS-enabled EVs, and compatibility varies by model. Check the tested vehicle list before buying.', // RoamEnergy product page
  cta: 'Get an extra 10% off PowerBridge Pro', // site
  ctaNote: 'Discount applied in cart.', // site
  image:
    'https://roamenergy.tech/cdn/shop/files/PRO-US-main-01.jpg?v=1781766494&width=720', // used on mochaev.com/powerbridgepro.html
};

// Every number in the story is a demonstration value, labeled on screen.
export const SCENARIO = {
  label: 'Illustrative scenario',
  startRange: 32,
  chargerAppearsAt: 18,
  chargerDistance: 27,
  outOfServiceMile: 25,
  batteryTo: 12,
};
