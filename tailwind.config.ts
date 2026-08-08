import type { Config } from "tailwindcss";

// Colour tokens pulled directly from the Tiger's Car Rental logo (sampled
// from the actual logo file, not approximated) — deep charcoal background,
// tiger orange as the primary accent, warm tan as a secondary accent
// echoing the tiger's fur tone.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        customer: {
          DEFAULT: "#181614", // deep charcoal — matches the logo's black background
          light: "#2A2622",   // lighter charcoal for gradients/hover states
          accent: "#E5843B",  // tiger orange, sampled directly from the logo
          brown: "#8B6544",   // secondary accent — the tiger's fur tone
        },
        // [Changed] Previously a deliberately distinct-but-related palette
        // (a desaturated charcoal-green) so the admin portal read as its own
        // space while still feeling part of the same product. That decision
        // is reversed here: admin now shares the customer portal's exact
        // colours, so the whole site — customer-facing and staff-facing —
        // reads as one cohesive product rather than two visually separate
        // ones. The token is kept (rather than replacing every bg-admin/
        // text-admin usage throughout the codebase with bg-customer) so
        // this is a single, low-risk change in one place.
        admin: {
          DEFAULT: "#181614", // now identical to customer.DEFAULT
          light: "#2A2622",   // now identical to customer.light
        },
        status: {
          available: "#1B8A5A",
          onRental: "#D99A00",
          maintenance: "#C0392B",
        },
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      keyframes: {
        "paw-pulse": {
          "0%, 100%": { opacity: "0" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: {
        "paw-pulse": "paw-pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
