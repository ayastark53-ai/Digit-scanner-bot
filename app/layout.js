import "./globals.css";

export const metadata = {
  title: "Digit Scanner — synthetic index bot",
  description: "Scans Deriv synthetic indices for even/odd and over/under digit setups.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
