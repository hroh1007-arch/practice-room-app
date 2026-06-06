"use client";

export default function AdminRolesPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border p-8">
        <h1 className="text-4xl font-bold mb-6">Manage Roles</h1>

        <p className="text-gray-600 mb-6">
          Admin role management page is working.
        </p>

        <button
          onClick={() => (window.location.href = "/admin-bookings")}
          className="border px-4 py-2 rounded-lg hover:bg-gray-100"
        >
          Back to Admin
        </button>
      </div>
    </main>
  );
}
