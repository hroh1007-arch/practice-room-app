import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TC Music Booking System",
  description: "Teachers College Music & Music Education",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        <div className="bg-white border-b shadow-sm px-6 py-4 flex gap-4 items-center sticky top-0 z-50">
          <button
            onClick={() => (window.location.href = "/")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Main Menu
          </button>

          <button
            onClick={() => (window.location.href = "/practice")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Practice Rooms
          </button>

          <button
            onClick={() => (window.location.href = "/classrooms")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Classrooms
          </button>

          <button
            onClick={() => (window.location.href = "/equipment")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Equipment
          </button>
        </div>

        {children}
      </body>
    </html>
  );
}
