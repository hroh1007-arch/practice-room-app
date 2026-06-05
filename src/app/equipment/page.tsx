"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type EquipmentItem = {
  id: string;
  inventory_code: string | null;
  category: string | null;
  item_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  status: string | null;
  notes: string | null;
};

type Checkout = {
  id: string;
  equipment_code: string | null;
  renter_name: string | null;
  uni: string | null;
  email: string | null;
  instructor: string | null;
  checkout_date: string | null;
  return_date: string | null;
  notes: string | null;
};

type UserRole = {
  email: string;
  role: "admin" | "instructor";
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

export default function EquipmentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [view, setView] = useState<"inventory" | "checkouts">("inventory");
  const [search, setSearch] = useState("");

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isBackupAdmin = user?.email
    ? backupAdminEmails.includes(user.email.toLowerCase())
    : false;

  const isAdmin = currentRole === "admin" || isBackupAdmin;

  async function loadData() {
    const { data: roleData } = await supabase.from("user_roles").select("*");
    setRoles(roleData || []);

    const { data: itemData } = await supabase
      .from("equipment_items")
      .select("*")
      .order("category", { ascending: true })
      .order("inventory_code", { ascending: true });

    setItems(itemData || []);

    const { data: checkoutData } = await supabase
      .from("equipment_checkouts")
      .select("*")
      .order("checkout_date", { ascending: false });

    setCheckouts(checkoutData || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadData();
  }, [user?.email]);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/equipment",
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function matchesSearch(value: any) {
    return String(value || "").toLowerCase().includes(search.toLowerCase());
  }

  const filteredItems = items.filter((item) =>
    [
      item.inventory_code,
      item.category,
      item.item_name,
      item.manufacturer,
      item.model,
      item.serial_number,
      item.location,
      item.status,
      item.notes,
    ].some(matchesSearch)
  );

  const filteredCheckouts = checkouts.filter((checkout) =>
    [
      checkout.equipment_code,
      checkout.renter_name,
      checkout.uni,
      checkout.email,
      checkout.instructor,
      checkout.checkout_date,
      checkout.return_date,
      checkout.notes,
    ].some(matchesSearch)
  );

  async function editItem(item: EquipmentItem) {
    if (!isAdmin) return;

    const inventory_code = prompt("Inventory Code:", item.inventory_code || "");
    if (inventory_code === null) return;

    const category = prompt("Category:", item.category || "");
    if (category === null) return;

    const item_name = prompt("Item Name:", item.item_name || "");
    if (item_name === null) return;

    const manufacturer = prompt("Manufacturer:", item.manufacturer || "");
    if (manufacturer === null) return;

    const model = prompt("Model:", item.model || "");
    if (model === null) return;

    const serial_number = prompt("Serial Number:", item.serial_number || "");
    if (serial_number === null) return;

    const location = prompt("Location:", item.location || "");
    if (location === null) return;

    const status = prompt("Status:", item.status || "");
    if (status === null) return;

    const notes = prompt("Notes:", item.notes || "");
    if (notes === null) return;

    const { error } = await supabase
      .from("equipment_items")
      .update({
        inventory_code,
        category,
        item_name,
        manufacturer,
        model,
        serial_number,
        location,
        status,
        notes,
      })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Inventory item updated.");
  }

  async function addItem() {
    if (!isAdmin) return;

    const inventory_code = prompt("Inventory Code:");
    if (!inventory_code) return;

    const category = prompt("Category:") || "";
    const item_name = prompt("Item Name:") || "";
    const manufacturer = prompt("Manufacturer:") || "";
    const model = prompt("Model:") || "";
    const serial_number = prompt("Serial Number:") || "";
    const location = prompt("Location:") || "";
    const status = prompt("Status:") || "Available";
    const notes = prompt("Notes:") || "";

    const { error } = await supabase.from("equipment_items").insert({
      inventory_code,
      category,
      item_name,
      manufacturer,
      model,
      serial_number,
      location,
      status,
      notes,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Inventory item added.");
  }

  async function deleteItem(id: string) {
    if (!isAdmin) return;

    const confirmed = confirm("Delete this inventory item?");
    if (!confirmed) return;

    const { error } = await supabase.from("equipment_items").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Inventory item deleted.");
  }

  async function editCheckout(checkout: Checkout) {
    if (!isAdmin) return;

    const equipment_code = prompt("Equipment Code:", checkout.equipment_code || "");
    if (equipment_code === null) return;

    const renter_name = prompt("Renter Name:", checkout.renter_name || "");
    if (renter_name === null) return;

    const uni = prompt("UNI:", checkout.uni || "");
    if (uni === null) return;

    const email = prompt("Email:", checkout.email || "");
    if (email === null) return;

    const instructor = prompt("Instructor:", checkout.instructor || "");
    if (instructor === null) return;

    const checkout_date = prompt("Checkout Date:", checkout.checkout_date || "");
    if (checkout_date === null) return;

    const return_date = prompt("Return Date:", checkout.return_date || "");
    if (return_date === null) return;

    const notes = prompt("Notes:", checkout.notes || "");
    if (notes === null) return;

    const { error } = await supabase
      .from("equipment_checkouts")
      .update({
        equipment_code,
        renter_name,
        uni,
        email,
        instructor,
        checkout_date,
        return_date,
        notes,
      })
      .eq("id", checkout.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Checkout record updated.");
  }

  async function addCheckout() {
    if (!isAdmin) return;

    const equipment_code = prompt("Equipment Code:");
    if (!equipment_code) return;

    const renter_name = prompt("Renter Name:") || "";
    const uni = prompt("UNI:") || "";
    const email = prompt("Email:") || "";
    const instructor = prompt("Instructor:") || "";
    const checkout_date = prompt("Checkout Date:") || "";
    const return_date = prompt("Return Date:") || "";
    const notes = prompt("Notes:") || "";

    const { error } = await supabase.from("equipment_checkouts").insert({
      equipment_code,
      renter_name,
      uni,
      email,
      instructor,
      checkout_date,
      return_date,
      notes,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Checkout record added.");
  }

  async function deleteCheckout(id: string) {
    if (!isAdmin) return;

    const confirmed = confirm("Delete this checkout record?");
    if (!confirmed) return;

    const { error } = await supabase.from("equipment_checkouts").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Checkout record deleted.");
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Equipment Inventory</h1>
          <p className="text-gray-600 mb-6">Log in with TC/CU Google.</p>

          <button
            onClick={login}
            className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full"
          >
            Continue with TC/CU Google
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full mt-3"
          >
            Back to Practice Rooms
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">
            Equipment Inventory
          </h1>

          <p className="text-gray-600 mt-2">
            View inventory. Admins can edit inventory and checkout records.
          </p>
        </div>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
          <button
            onClick={() => (window.location.href = "/")}
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
            onClick={() => setView("inventory")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Inventory
          </button>

          <button
            onClick={() => setView("checkouts")}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Checkout List
          </button>

          {isAdmin && view === "inventory" && (
            <button
              onClick={addItem}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Add Item
            </button>
          )}

          {isAdmin && view === "checkouts" && (
            <button
              onClick={addCheckout}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Add Checkout
            </button>
          )}

          <span className="text-gray-700">
            Logged in as <strong>{user.email}</strong>
            {isAdmin && <span> · admin</span>}
          </span>

          <button
            onClick={logout}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Log out
          </button>

          <input
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-4 py-2 ml-auto"
          />
        </div>

        {view === "inventory" && (
          <div className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 border text-left">Code</th>
                  <th className="p-3 border text-left">Category</th>
                  <th className="p-3 border text-left">Item</th>
                  <th className="p-3 border text-left">Manufacturer</th>
                  <th className="p-3 border text-left">Model</th>
                  <th className="p-3 border text-left">Serial</th>
                  <th className="p-3 border text-left">Location</th>
                  <th className="p-3 border text-left">Status</th>
                  <th className="p-3 border text-left">Notes</th>
                  {isAdmin && <th className="p-3 border text-left">Admin</th>}
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 border">{item.inventory_code}</td>
                    <td className="p-3 border">{item.category}</td>
                    <td className="p-3 border">{item.item_name}</td>
                    <td className="p-3 border">{item.manufacturer}</td>
                    <td className="p-3 border">{item.model}</td>
                    <td className="p-3 border">{item.serial_number}</td>
                    <td className="p-3 border">{item.location}</td>
                    <td className="p-3 border">{item.status}</td>
                    <td className="p-3 border">{item.notes}</td>

                    {isAdmin && (
                      <td className="p-3 border">
                        <div className="flex gap-2">
                          <button
                            onClick={() => editItem(item)}
                            className="border px-3 py-1 rounded hover:bg-gray-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteItem(item.id)}
                            className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "checkouts" && (
          <div className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 border text-left">Equipment Code</th>
                  <th className="p-3 border text-left">Renter</th>
                  <th className="p-3 border text-left">UNI</th>
                  <th className="p-3 border text-left">Email</th>
                  <th className="p-3 border text-left">Instructor</th>
                  <th className="p-3 border text-left">Checkout</th>
                  <th className="p-3 border text-left">Return</th>
                  <th className="p-3 border text-left">Notes</th>
                  {isAdmin && <th className="p-3 border text-left">Admin</th>}
                </tr>
              </thead>

              <tbody>
                {filteredCheckouts.map((checkout) => (
                  <tr key={checkout.id}>
                    <td className="p-3 border">{checkout.equipment_code}</td>
                    <td className="p-3 border">{checkout.renter_name}</td>
                    <td className="p-3 border">{checkout.uni}</td>
                    <td className="p-3 border">{checkout.email}</td>
                    <td className="p-3 border">{checkout.instructor}</td>
                    <td className="p-3 border">{checkout.checkout_date}</td>
                    <td className="p-3 border">{checkout.return_date}</td>
                    <td className="p-3 border">{checkout.notes}</td>

                    {isAdmin && (
                      <td className="p-3 border">
                        <div className="flex gap-2">
                          <button
                            onClick={() => editCheckout(checkout)}
                            className="border px-3 py-1 rounded hover:bg-gray-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteCheckout(checkout.id)}
                            className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
