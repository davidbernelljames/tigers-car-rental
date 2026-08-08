import { Anton } from "next/font/google";

// A bold, condensed, high-impact font for the brand wordmark — chosen to
// match the energy of the tiger logo rather than sitting next to it in a
// generic sans-serif. Used only for the site name in the header (and
// anywhere else the brand wordmark appears), not for body text.
export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
