import "./globals.css";

export const metadata = {
  title: "Merchant Pipeline Dashboard",
  description: "S-Interio Merchant Pipeline Dashboard for Monday CRM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
