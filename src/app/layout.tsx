import "./globals.css";

export const metadata = {
  title: "TC Music Booking",
  description: "Teachers College Music Booking System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
