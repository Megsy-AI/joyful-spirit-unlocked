/**
 * Prompts Library — curated, copy-paste-ready prompts that produce premium sites.
 * Each prompt links to an existing live HTML preview shipped in /public/templates.
 *
 * Preview opens on our same origin: /templates/{previewSlug}/index.html
 */

export type PromptCategory =
  | "Portfolio"
  | "3D & Interactive"
  | "SaaS & AI"
  | "Brand & Product"
  | "Editorial"
  | "Game & Entertainment"
  | "Science & Data";

export interface PromptItem {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  /** Existing HTML template folder under /public/templates used for preview */
  previewSlug: string;
  /** The actual prompt body the user will copy */
  prompt: string;
  /** Pro-locked? */
  pro: boolean;
  /** Optional accent gradient for card */
  accent?: string;
}

const G = {
  violet: "linear-gradient(135deg,#7c3aed 0%,#ec4899 100%)",
  cyan: "linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%)",
  amber: "linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)",
  emerald: "linear-gradient(135deg,#10b981 0%,#0ea5e9 100%)",
  rose: "linear-gradient(135deg,#f43f5e 0%,#8b5cf6 100%)",
  slate: "linear-gradient(135deg,#1e293b 0%,#475569 100%)",
  gold: "linear-gradient(135deg,#fbbf24 0%,#b45309 100%)",
  neon: "linear-gradient(135deg,#22d3ee 0%,#a78bfa 60%,#f472b6 100%)",
};

export const PROMPTS: PromptItem[] = [
  {
    id: "p-3d-portfolio",
    title: "Cinematic 3D Portfolio",
    description: "Neon-drenched interactive portfolio with WebGL hero.",
    category: "Portfolio",
    previewSlug: "remix-interactive-3d-portfolio",
    pro: true,
    accent: G.neon,
    prompt:
      "Build a cinematic personal portfolio with a full-screen WebGL/Three.js hero scene, an animated cursor follower, smooth Lenis scroll, parallax sections for About / Selected Work / Process / Contact, magnetic buttons, and a sticky footer with neon accents on a near-black background. Use 'Instrument Serif' for display and 'Inter' for body, with grain texture overlay.",
  },
  {
    id: "p-neon-designer",
    title: "Neon UI Designer Folio",
    description: "Designer portfolio with neon gradient hero.",
    category: "Portfolio",
    previewSlug: "remix-neon-portfolio-for-ui-de",
    pro: true,
    accent: G.violet,
    prompt:
      "Create a UI designer portfolio with a neon gradient hero, marquee of selected clients, case-study cards with hover tilt, an interactive process timeline, and a closing CTA with glassmorphism card. Dark theme, electric purple to cyan gradient, geometric sans display font.",
  },
  {
    id: "p-yash-folio",
    title: "Editorial Designer Folio",
    description: "Big-type editorial portfolio with sticky nav.",
    category: "Portfolio",
    previewSlug: "remix-yash-designer-folio",
    pro: false,
    accent: G.slate,
    prompt:
      "Design a minimal editorial designer folio: oversized serif type, horizontal-scroll project gallery, sticky top nav with section indicator, project pages with full-bleed imagery and case study writeup, and a contact section with email + socials.",
  },
  {
    id: "p-bold-3d-typo",
    title: "Bold 3D Typography",
    description: "Massive 3D animated type as the hero.",
    category: "3D & Interactive",
    previewSlug: "remix-bold-3d-typography-portf",
    pro: true,
    accent: G.rose,
    prompt:
      "Build a single-page site where the hero is a giant 3D extruded headline that rotates with the mouse. Add a scroll-triggered section reveal with split-text animation, a project grid, and a footer with chunky outlined buttons. Bauhaus inspired palette.",
  },
  {
    id: "p-3d-car",
    title: "3D Car Scroll Experience",
    description: "Scroll-driven 3D car reveal landing page.",
    category: "3D & Interactive",
    previewSlug: "remix-3d-car-scroll-website",
    pro: true,
    accent: G.slate,
    prompt:
      "Build a product launch site for a high-performance EV: scroll-controlled 3D car rotation, pinned sections highlighting features (battery, motor, interior), spec table, and a reservation CTA. Premium automotive feel, dark with chrome accents.",
  },
  {
    id: "p-iphone-launch",
    title: "Next-Gen Phone Launch",
    description: "Apple-style product launch page.",
    category: "Brand & Product",
    previewSlug: "remix-next-generation-iphone",
    pro: true,
    accent: G.slate,
    prompt:
      "Create an Apple-style flagship phone launch page with hero device shot, scroll-driven color changes, feature highlights with sticky imagery, comparison table, and a 'Buy now' sticky bottom bar on mobile. SF-pro-like typography, generous whitespace.",
  },
  {
    id: "p-spiderman",
    title: "Comic Book Hero Site",
    description: "Comic-book cinematic landing.",
    category: "Game & Entertainment",
    previewSlug: "remix-cool-spiderman-website",
    pro: false,
    accent: G.amber,
    prompt:
      "Design a cinematic comic-book themed landing page: bold halftone textures, comic-burst stickers, kinetic typography hero, scrolling panels with parallax, character cards, and a 'Watch Trailer' CTA modal.",
  },
  {
    id: "p-game-launch",
    title: "Game Launch Page",
    description: "High-energy AAA game landing page.",
    category: "Game & Entertainment",
    previewSlug: "remix-game-landing-page-design",
    pro: true,
    accent: G.rose,
    prompt:
      "Build a high-energy AAA game launch page with cinematic looping background video, animated logo, release countdown, gameplay feature reel, editions comparison, system requirements, and pre-order CTA. Neon gradient on near-black.",
  },
  {
    id: "p-ai-builder",
    title: "AI Product SaaS",
    description: "Modern SaaS landing for an AI product.",
    category: "SaaS & AI",
    previewSlug: "remix-ai-website-builder-unlim",
    pro: false,
    accent: G.cyan,
    prompt:
      "Build a modern AI SaaS landing page: gradient hero with animated prompt input mock, social proof bar, 'How it works' 3-step section, feature grid with iconography, pricing with monthly/annual toggle, FAQ, and a strong final CTA. Light theme with vivid accent.",
  },
  {
    id: "p-ai-video",
    title: "AI Video Generator",
    description: "Landing for an AI video tool.",
    category: "SaaS & AI",
    previewSlug: "remix-ai-video-generator-websi",
    pro: true,
    accent: G.violet,
    prompt:
      "Create a landing page for an AI video generator: hero with auto-playing demo video, before/after slider, prompts gallery with reuse buttons, creator testimonials, pricing tiers, and a 'Try it free' sticky CTA.",
  },
  {
    id: "p-aiventraq",
    title: "AI Automation Agency",
    description: "Premium agency site for AI automation.",
    category: "SaaS & AI",
    previewSlug: "remix-aiventraq-ai-automation",
    pro: true,
    accent: G.emerald,
    prompt:
      "Build a premium AI automation agency site with: animated mesh-gradient hero, services grid (workflows, agents, integrations), case studies carousel, team section, contact form. Dark mode with emerald-to-cyan glow.",
  },
  {
    id: "p-modern-ai",
    title: "Visible AI Modern Site",
    description: "Sleek site for AI products.",
    category: "SaaS & AI",
    previewSlug: "remix-modern-ai-visible-websit",
    pro: true,
    accent: G.cyan,
    prompt:
      "Create a sleek modern AI product site with: kinetic headline, live model demo card, integrations cloud, security badges row, pricing, and a documentation teaser block linking to docs.",
  },
  {
    id: "p-synthra",
    title: "Synthra AI Builder",
    description: "Futuristic AI builder homepage.",
    category: "SaaS & AI",
    previewSlug: "remix-synthra-builder",
    pro: true,
    accent: G.violet,
    prompt:
      "Build a futuristic AI builder homepage with iridescent gradients, animated wireframe globe, live build counter, capability cards, testimonials, and a glowing primary CTA.",
  },
  {
    id: "p-vanta",
    title: "Vanta Digital Atelier",
    description: "Dark editorial studio site.",
    category: "Editorial",
    previewSlug: "remix-vanta-digital-atelier",
    pro: true,
    accent: G.slate,
    prompt:
      "Design a dark editorial digital studio site with oversized italic serif headlines, awarded projects grid, services list, manifesto block, and refined micro-interactions throughout.",
  },
  {
    id: "p-documentary",
    title: "Documentary Storytelling",
    description: "Long-form documentary research site.",
    category: "Editorial",
    previewSlug: "remix-documentary-research-and",
    pro: false,
    accent: G.amber,
    prompt:
      "Build a long-form documentary storytelling page: full-bleed hero photo with fade-in title, chapter-based sections with pull quotes, archival imagery, footnotes sidebar on desktop, and a credits closing section.",
  },
  {
    id: "p-fashion-ice",
    title: "Editorial Fashion",
    description: "High-fashion editorial with ice imagery.",
    category: "Editorial",
    previewSlug: "remix-fashion-ice-cubes",
    pro: true,
    accent: G.cyan,
    prompt:
      "Design a high-fashion editorial landing for a capsule collection: full-bleed ice/water imagery, oversized serif type, scroll-driven look-book, product capsule grid, lookbook video, and stockists section.",
  },
  {
    id: "p-veloured",
    title: "Veloured Modern Landing",
    description: "Premium minimal landing.",
    category: "Brand & Product",
    previewSlug: "remix-veloured-modern-landing-",
    pro: true,
    accent: G.gold,
    prompt:
      "Build a premium minimal landing page for a luxury product: large editorial hero, three feature pillars, brand story block, testimonials, and a refined dark footer. Cream and graphite palette.",
  },
  {
    id: "p-forma",
    title: "Forma Ergonomic Product",
    description: "Premium product page with 3D feel.",
    category: "Brand & Product",
    previewSlug: "remix-forma-ergonomic-sofa",
    pro: true,
    accent: G.emerald,
    prompt:
      "Create a premium ergonomic furniture product page: hero with floating 3D product, materials breakdown, modular configurator mock, customer reviews, FAQs, and an 'Add to cart' sticky bar.",
  },
  {
    id: "p-baresol",
    title: "Baresol Skincare",
    description: "Clean skincare brand site.",
    category: "Brand & Product",
    previewSlug: "remix-baresol-skincare",
    pro: false,
    accent: G.amber,
    prompt:
      "Design a clean skincare brand landing: pastel hero with product hero shot, ingredients grid with iconography, routine builder, before/after gallery, press logos, and newsletter signup.",
  },
  {
    id: "p-aquara",
    title: "Aquara Premium Water",
    description: "Mineral water brand landing.",
    category: "Brand & Product",
    previewSlug: "remix-aquara-water",
    pro: true,
    accent: G.cyan,
    prompt:
      "Build a premium mineral water brand landing with: glassmorphism hero featuring product bottle, source story, mineral composition chart, sustainability section, and 'Find a store' map block.",
  },
  {
    id: "p-noodles",
    title: "Playful Food Splash",
    description: "Bright playful food product splash page.",
    category: "Brand & Product",
    previewSlug: "remix-noodles-splash-page",
    pro: false,
    accent: G.amber,
    prompt:
      "Design a playful food product splash page: bold colors, oversized rounded type, sticker-style accents, flavors carousel, recipe cards grid, and a where-to-buy section.",
  },
  {
    id: "p-kami",
    title: "Kami Notebook",
    description: "Stationery product landing.",
    category: "Brand & Product",
    previewSlug: "remix-kami-notebook",
    pro: false,
    accent: G.slate,
    prompt:
      "Build a stationery notebook product page: warm paper textures, hero spread photo, paper specs, page templates carousel, gift-wrap section, and reviews block.",
  },
  {
    id: "p-prisma",
    title: "Prisma Creative Studio",
    description: "Colorful creative studio site.",
    category: "Editorial",
    previewSlug: "remix-prisma-creative-studio",
    pro: true,
    accent: G.rose,
    prompt:
      "Create a colorful creative studio site: animated gradient hero, services pillars, case studies grid with hover videos, team grid, and contact form with playful microcopy.",
  },
  {
    id: "p-landscape",
    title: "Landscape Architecture",
    description: "Architecture studio site.",
    category: "Editorial",
    previewSlug: "remix-landscape-design",
    pro: true,
    accent: G.emerald,
    prompt:
      "Build a landscape architecture studio site: full-bleed nature imagery, projects map, philosophy block, awards row, and a contact section with studio address and map.",
  },
  {
    id: "p-blobs",
    title: "Soft 3D Blob Landing",
    description: "Friendly 3D blob landing page.",
    category: "3D & Interactive",
    previewSlug: "remix-landing-page-blobs",
    pro: false,
    accent: G.violet,
    prompt:
      "Design a friendly landing page with soft 3D blobs floating in the hero, pastel gradient, feature cards with iconography, testimonials, and a final CTA card.",
  },
  {
    id: "p-helmet",
    title: "Interactive 3D Helmet",
    description: "Product showcase with interactive 3D.",
    category: "3D & Interactive",
    previewSlug: "remix-interactive-3d-helmet-sh",
    pro: true,
    accent: G.slate,
    prompt:
      "Build a product showcase with an interactive 3D helmet hero (drag to rotate), highlights, materials, sizing guide, and add-to-cart sticky bar on mobile.",
  },
  {
    id: "p-marketplace-3d",
    title: "3D Digital Marketplace",
    description: "Marketplace with 3D asset previews.",
    category: "3D & Interactive",
    previewSlug: "remix-interactive-3d-digital-m",
    pro: true,
    accent: G.cyan,
    prompt:
      "Create a 3D digital asset marketplace homepage: search hero, featured assets carousel with 3D previews, categories grid, creators spotlight, and a 'Become a seller' band.",
  },
  {
    id: "p-voxel",
    title: "Voxel Art Site",
    description: "Voxel art portfolio.",
    category: "3D & Interactive",
    previewSlug: "remix-voxel-website",
    pro: false,
    accent: G.violet,
    prompt:
      "Design a voxel artist portfolio: pixel-perfect chunky type, animated voxel hero, project grid, commission CTA, and a contact form.",
  },
  {
    id: "p-science-lab",
    title: "Science Lab Interactive",
    description: "Interactive science lab site.",
    category: "Science & Data",
    previewSlug: "remix-science-lab-website-with",
    pro: true,
    accent: G.emerald,
    prompt:
      "Build an interactive science lab site: animated molecules hero, research areas grid, publications list, lab members, and contact / collaborate form.",
  },
  {
    id: "p-ocean-buoy",
    title: "Real-Time Ocean Data",
    description: "Live data dashboard styled landing.",
    category: "Science & Data",
    previewSlug: "remix-real-time-ocean-buoy-dat",
    pro: true,
    accent: G.cyan,
    prompt:
      "Build a real-time ocean buoy data landing: hero with animated wave chart, live metrics tiles, station map, methodology section, and download CSV CTA.",
  },
  {
    id: "p-robotics",
    title: "Robotic Technologies",
    description: "Industrial robotics company site.",
    category: "Science & Data",
    previewSlug: "remix-robotic-technologies-202",
    pro: true,
    accent: G.slate,
    prompt:
      "Design an industrial robotics company site: bold dark hero with mechanical visuals, capabilities pillars, case studies, R&D lab section, careers strip, and contact CTA.",
  },
  {
    id: "p-premium-consulting",
    title: "Premium Tech Consulting",
    description: "Refined consulting firm landing.",
    category: "SaaS & AI",
    previewSlug: "remix-premium-tech-consulting",
    pro: true,
    accent: G.gold,
    prompt:
      "Build a refined premium tech consulting landing: editorial hero with one strong promise, services pillars, marquee of clients, case studies carousel, team grid, and book-a-call CTA.",
  },
  {
    id: "p-silent-wealth",
    title: "Silent Wealth Finance",
    description: "Discreet luxury finance brand site.",
    category: "Brand & Product",
    previewSlug: "remix-silent-wealth",
    pro: true,
    accent: G.gold,
    prompt:
      "Design a discreet luxury private-wealth brand site: serif editorial type, neutral palette, philosophy block, services, principals, insights/journal grid, and a contact form for qualified inquiries.",
  },
  {
    id: "p-flavora",
    title: "Flavora Meal Planner",
    description: "Interactive meal planning landing.",
    category: "SaaS & AI",
    previewSlug: "remix-flavora-interactive-meal",
    pro: false,
    accent: G.amber,
    prompt:
      "Build an interactive meal planning landing: hero with daily plan card, dietary filters, recipes grid, weekly planner mock, pricing, and download app CTA.",
  },
  {
    id: "p-storm-calm",
    title: "Storm-to-Calm Scroll",
    description: "Atmospheric scroll storytelling.",
    category: "3D & Interactive",
    previewSlug: "remix-storm-to-calm-scrolling",
    pro: true,
    accent: G.slate,
    prompt:
      "Design an atmospheric scroll-storytelling landing that transitions from storm to calm imagery, with chapter callouts, ambient audio toggle, and a final invitation CTA.",
  },
  {
    id: "p-seasonal-scroll",
    title: "Seasonal Scroll Experience",
    description: "Four-seasons scroll page.",
    category: "3D & Interactive",
    previewSlug: "remix-seasonal-scroll-experien",
    pro: true,
    accent: G.emerald,
    prompt:
      "Build a four-seasons scroll experience: hero per season with parallax flora, type that morphs with scroll, ambient color shift, and a closing newsletter card.",
  },
];

export const PROMPT_CATEGORIES: PromptCategory[] = [
  "Portfolio",
  "3D & Interactive",
  "SaaS & AI",
  "Brand & Product",
  "Editorial",
  "Game & Entertainment",
  "Science & Data",
];
