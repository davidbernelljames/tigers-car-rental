import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiger's Car Rental",
  description:
    "Reliable vehicle rentals near Piarco International Airport. Book online, pay securely, drive away.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
