"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Item = {
  id?: string;
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
  id?: string;
  equipment_code: string | null;
  renter_name: string | null;
  uni: string | null;
  email: string | null;
  instructor: string | null;
  checkout_date: string | null;
  return_date: string | null;
  actual_return_date?: string | null;
  returned?: boolean | null;
  notes: string | null;
};

type RequestRow = {
  id?: string;
  equipment_id?: string | null;
  equipment_code: string | null;
  item_name: string | null;
  requester_name?: string | null;
  requester_email: string | null;
  requester_uni: string | null;
  phone?: string | null;
  programme?: string | null;
  instructor?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  reason: string | null;
  status: string | null;
};

type Role = {
  email: string;
  role: "admin" | "instructor";
};

const backupAdminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

const emptyItem: Item = {
  inventory_code: "",
  category: "",
  item_name: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  location: "",
  status: "Available",
  notes: "",
};

const emptyCheckout: Checkout = {
  equipment_code: "",
  renter_name: "",
  uni: "",
  email: "",
  instructor: "",
  checkout_date: "",
  return_date: "",
  actual_return_date: "",
  returned: false,
  notes: "",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function uniFromEmail(email?: string | null) {
  return email ? email.split("@")[0] : "";
}

export default function EquipmentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [view, setView] = useState<"inventory" | "active" | "returned" | "requests">("inventory");
  const [search, setSearch] = useState("");

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item>(emptyItem);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [editingCheckout, setEditingCheckout] = useState<Checkout>(emptyCheckout);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestItem, setRequestItem] = useState<Item | null>(null);
  const [requestForm, setRequestForm] = useState({
    requester_name: "",
    requester_uni: "",
    requester_email: "",
    phone: "",
    programme: "",
    instructor: "",
    start_date: today(),
    start_time: "09:00",
    end_date: today(),
    end_time: "17:00",
    reason: "",
  });

  const currentRole = user?.email
    ? roles.find((r) => r.email.toLowerCase() === user.email?.toLowerCase())?.role
    : undefined;

  const isAdmin =
    currentRole === "admin" ||
    (user?.email ? backupAdminEmails.includes(user.email.toLowerCase()) : false);

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

    const { data: requestData } = await supabase
      .from("equipment_requests")
      .select("*")
      .order("created_at", { ascending: false });

    setRequests(requestData || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

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
      options: { redirectTo: window.location.origin + "/equipment" },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function match(values: Array<string | null | undefined>) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return values.some((v) => String(v || "").toLowerCase().includes(q));
  }

  const activeCodes = new Set(
    checkouts.filter((c) => !c.returned).map((c) => String(c.equipment_code || "").toLowerCase())
  );

  const shownItems = items.filter((item) =>
    match([
      item.inventory_code,
      item.category,
      item.item_name,
      item.manufacturer,
      item.model,
      item.serial_number,
      item.location,
      item.status,
      item.notes,
    ])
  );

  const shownActive = checkouts
    .filter((c) => !c.returned)
    .filter((c) =>
      match([c.equipment_code, c.renter_name, c.uni, c.email, c.instructor, c.checkout_date, c.return_date, c.notes])
    );

  const shownReturned = checkouts
    .filter((c) => c.returned)
    .filter((c) =>
      match([c.equipment_code, c.renter_name, c.uni, c.email, c.instructor, c.checkout_date, c.return_date, c.actual_return_date, c.notes])
    );

  const shownRequests = requests.filter((r) =>
    match([r.equipment_code, r.item_name, r.requester_name, r.requester_uni, r.requester_email, r.status, r.reason])
  );

  function openAddItem() {
    setEditingItem({ ...emptyItem });
    setShowItemModal(true);
  }

  function openEditItem(item: Item) {
    setEditingItem({ ...item });
    setShowItemModal(true);
  }

  async function saveItem() {
    if (!isAdmin) return;

    if (!editingItem.inventory_code) {
      alert("Inventory code is required.");
      return;
    }

    const payload = {
      inventory_code: editingItem.inventory_code,
      category: editingItem.category,
      item_name: editingItem.item_name,
      manufacturer: editingItem.manufacturer,
      model: editingItem.model,
      serial_number: editingItem.serial_number,
      location: editingItem.location,
      status: editingItem.status,
      notes: editingItem.notes,
    };

    const result = editingItem.id
      ? await supabase.from("equipment_items").update(payload).eq("id", editingItem.id)
      : await supabase.from("equipment_items").insert(payload);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setShowItemModal(false);
    await loadData();
  }

  async function deleteItem(id?: string) {
    if (!isAdmin || !id) return;

    if (!confirm("Delete this inventory item?")) return;

    const { error } = await supabase.from("equipment_items").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  function openAddCheckout(code?: string | null) {
    setEditingCheckout({
      ...emptyCheckout,
      equipment_code: code || "",
      checkout_date: today(),
    });
    setShowCheckoutModal(true);
  }

  function openEditCheckout(checkout: Checkout) {
    setEditingCheckout({ ...checkout });
    setShowCheckoutModal(true);
  }

  async function saveCheckout() {
    if (!isAdmin) return;

    if (!editingCheckout.equipment_code) {
      alert("Equipment code is required.");
      return;
    }

    const payload = {
      equipment_code: editingCheckout.equipment_code,
      renter_name: editingCheckout.renter_name,
      uni: editingCheckout.uni,
      email: editingCheckout.email,
      instructor: editingCheckout.instructor,
      checkout_date: editingCheckout.checkout_date,
      return_date: editingCheckout.return_date,
      actual_return_date: editingCheckout.actual_return_date,
      returned: Boolean(editingCheckout.returned),
      notes: editingCheckout.notes,
    };

    const result = editingCheckout.id
      ? await supabase.from("equipment_checkouts").update(payload).eq("id", editingCheckout.id)
      : await supabase.from("equipment_checkouts").insert(payload);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setShowCheckoutModal(false);
    await loadData();
  }

  async function deleteCheckout(id?: string) {
    if (!isAdmin || !id) return;

    if (!confirm("Delete this checkout record?")) return;

    const { error } = await supabase.from("equipment_checkouts").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function markReturned(checkout: Checkout) {
    if (!isAdmin || !checkout.id) return;

    const returnDate = prompt("Actual return date:", today());
    if (!returnDate) return;

    const { error } = await supabase
      .from("equipment_checkouts")
      .update({
        returned: true,
        actual_return_date: returnDate,
      })
      .eq("id", checkout.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  function openRequest(item: Item) {
    setRequestItem(item);
    setRequestForm({
      requester_name: "",
      requester_uni: uniFromEmail(user?.email),
      requester_email: user?.email || "",
      phone: "",
      programme: "",
      instructor: "",
      start_date: today(),
      start_time: "09:00",
      end_date: today(),
      end_time: "17:00",
      reason: "",
    });
    setShowRequestModal(true);
  }

  async function submitRequest() {
    if (!user || !requestItem) return;

    if (!requestForm.requester_name || !requestForm.requester_email || !requestForm.start_date || !requestForm.end_date) {
      alert("Name, email, start date, and end date are required.");
      return;
    }

    const { error } = await supabase.from("equipment_requests").insert({
      equipment_id: requestItem.id || null,
      equipment_code: requestItem.inventory_code,
      item_name: requestItem.item_name || requestItem.model || "",
      requester_name: requestForm.requester_name,
      requester_email: requestForm.requester_email,
      requester_uni: requestForm.requester_uni,
      phone: requestForm.phone,
      programme: requestForm.programme,
      instructor: requestForm.instructor,
      start_date: requestForm.start_date,
      start_time: requestForm.start_time,
      end_date: requestForm.end_date,
      end_time: requestForm.end_time,
      reason: requestForm.reason,
      status: "pending",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setShowRequestModal(false);
    await loadData();
    alert("Request submitted.");
  }

  async function approveRequest(request: RequestRow) {
    if (!isAdmin || !request.id) return;

    const { error: checkoutError } = await supabase.from("equipment_checkouts").insert({
      equipment_code: request.equipment_code,
      renter_name: request.requester_name || "",
      uni: request.requester_uni || "",
      email: request.requester_email || "",
      instructor: request.instructor || "",
      checkout_date: request.start_date || today(),
      return_date: request.end_date || "",
      returned: false,
      notes: request.reason || "",
    });

    if (checkoutError) {
      alert(checkoutError.message);
      return;
    }

    const { error } = await supabase
      .from("equipment_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.email || "",
      })
      .eq("id", request.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Request approved and moved to active renting.");
  }

  async function declineRequest(request: RequestRow) {
    if (!isAdmin || !request.id) return;

    const { error } = await supabase
      .from("equipment_requests")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        declined_by: user?.email || "",
      })
      .eq("id", request.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Request declined.");
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="bg-white border rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">Equipment Inventory</h1>
          <p className="text-gray-600 mb-6">Log in with TC/CU Google.</p>
          <button onClick={login} className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 w-full">
            Continue with TC/CU Google
          </button>


          <button onClick={() => (window.location.href = "/practice")} className="border px-5 py-3 rounded-lg hover:bg-gray-100 w-full mt-3">
            Back to Practice Rooms
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4">
            <h2 className="text-2xl font-bold">{editingItem.id ? "Edit Item" : "Add Item"}</h2>

            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2" placeholder="Inventory Code" value={editingItem.inventory_code || ""} onChange={(e) => setEditingItem({ ...editingItem, inventory_code: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Category" value={editingItem.category || ""} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Item Name" value={editingItem.item_name || ""} onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Manufacturer" value={editingItem.manufacturer || ""} onChange={(e) => setEditingItem({ ...editingItem, manufacturer: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Model" value={editingItem.model || ""} onChange={(e) => setEditingItem({ ...editingItem, model: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Serial Number" value={editingItem.serial_number || ""} onChange={(e) => setEditingItem({ ...editingItem, serial_number: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Location" value={editingItem.location || ""} onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Status" value={editingItem.status || ""} onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })} />
            </div>

            <textarea className="border rounded-lg px-3 py-2 w-full" placeholder="Notes" value={editingItem.notes || ""} onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })} />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowItemModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={saveItem} className="bg-black text-white px-4 py-2 rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4">
            <h2 className="text-2xl font-bold">{editingCheckout.id ? "Edit Checkout" : "Add Checkout"}</h2>

            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2" placeholder="Equipment Code" value={editingCheckout.equipment_code || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, equipment_code: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Renter Name" value={editingCheckout.renter_name || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, renter_name: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="UNI" value={editingCheckout.uni || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, uni: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Email" value={editingCheckout.email || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, email: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Instructor" value={editingCheckout.instructor || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, instructor: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="date" value={editingCheckout.checkout_date || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, checkout_date: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="date" value={editingCheckout.return_date || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, return_date: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="date" value={editingCheckout.actual_return_date || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, actual_return_date: e.target.value })} />
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(editingCheckout.returned)} onChange={(e) => setEditingCheckout({ ...editingCheckout, returned: e.target.checked })} />
              Returned
            </label>

            <textarea className="border rounded-lg px-3 py-2 w-full" placeholder="Notes" value={editingCheckout.notes || ""} onChange={(e) => setEditingCheckout({ ...editingCheckout, notes: e.target.value })} />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCheckoutModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={saveCheckout} className="bg-black text-white px-4 py-2 rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {showRequestModal && requestItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4">
            <h2 className="text-2xl font-bold">Request Equipment</h2>
            <p className="text-gray-600">
              {requestItem.inventory_code} · {requestItem.item_name || requestItem.model}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2" placeholder="Name" value={requestForm.requester_name} onChange={(e) => setRequestForm({ ...requestForm, requester_name: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="UNI" value={requestForm.requester_uni} onChange={(e) => setRequestForm({ ...requestForm, requester_uni: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Email" value={requestForm.requester_email} onChange={(e) => setRequestForm({ ...requestForm, requester_email: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Phone Number" value={requestForm.phone} onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Programme" value={requestForm.programme} onChange={(e) => setRequestForm({ ...requestForm, programme: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" placeholder="Instructor" value={requestForm.instructor} onChange={(e) => setRequestForm({ ...requestForm, instructor: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="date" value={requestForm.start_date} onChange={(e) => setRequestForm({ ...requestForm, start_date: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="time" value={requestForm.start_time} onChange={(e) => setRequestForm({ ...requestForm, start_time: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="date" value={requestForm.end_date} onChange={(e) => setRequestForm({ ...requestForm, end_date: e.target.value })} />
              <input className="border rounded-lg px-3 py-2" type="time" value={requestForm.end_time} onChange={(e) => setRequestForm({ ...requestForm, end_time: e.target.value })} />
            </div>

            <textarea className="border rounded-lg px-3 py-2 w-full" placeholder="Reason" value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRequestModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={submitRequest} className="bg-black text-white px-4 py-2 rounded-lg">Submit Request</button>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-gray-900">Equipment Inventory</h1>
            <p className="text-gray-600 mt-2">
              Inventory: {items.length} items · Active Renting: {checkouts.filter((c) => !c.returned).length} · Returned: {checkouts.filter((c) => c.returned).length} · Requests: {requests.length}
            </p>
          </div>

          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center flex-wrap">
            <button onClick={() => (window.location.href = "/practice")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Practice Rooms</button>
            <button onClick={() => (window.location.href = "/classrooms")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Classrooms</button>
            <button onClick={() => setView("inventory")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Inventory</button>
            <button onClick={() => setView("active")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Active Renting</button>
            <button onClick={() => setView("returned")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Returned</button>

            {isAdmin && (
              <>
                <button onClick={() => setView("requests")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Requests</button>
                {view === "inventory" && <button onClick={openAddItem} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Add Item</button>}
                {view === "active" && <button onClick={() => openAddCheckout()} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Add Checkout</button>}
              </>
            )}

            <span className="text-gray-700">
              Logged in as <strong>{user.email}</strong>{isAdmin && <span> · admin</span>}
            </span>

            <button onClick={logout} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Log out</button>

            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="border rounded-lg px-4 py-2 ml-auto" />
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
                    <th className="p-3 border text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {shownItems.map((item) => {
                    const checkedOut = activeCodes.has(String(item.inventory_code || "").toLowerCase());

                    return (
                      <tr key={item.id}>
                        <td className="p-3 border">{item.inventory_code}</td>
                        <td className="p-3 border">{item.category}</td>
                        <td className="p-3 border">{item.item_name}</td>
                        <td className="p-3 border">{item.manufacturer}</td>
                        <td className="p-3 border">{item.model}</td>
                        <td className="p-3 border">{item.serial_number}</td>
                        <td className="p-3 border">{item.location}</td>
                        <td className="p-3 border">{checkedOut ? "Checked out" : item.status}</td>
                        <td className="p-3 border">{item.notes}</td>
                        <td className="p-3 border">
                          <div className="flex gap-2 flex-wrap">
                            {!checkedOut && <button onClick={() => openRequest(item)} className="border px-3 py-1 rounded hover:bg-gray-100">Request</button>}
                            {isAdmin && (
                              <>
                                <button onClick={() => openAddCheckout(item.inventory_code)} className="border px-3 py-1 rounded hover:bg-gray-100">Checkout</button>
                                <button onClick={() => openEditItem(item)} className="border px-3 py-1 rounded hover:bg-gray-100">Edit</button>
                                <button onClick={() => deleteItem(item.id)} className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700">Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === "active" && (
            <CheckoutTable rows={shownActive} isAdmin={isAdmin} returned={false} onEdit={openEditCheckout} onDelete={deleteCheckout} onReturn={markReturned} />
          )}

          {view === "returned" && (
            <CheckoutTable rows={shownReturned} isAdmin={isAdmin} returned={true} onEdit={openEditCheckout} onDelete={deleteCheckout} onReturn={markReturned} />
          )}

          {view === "requests" && isAdmin && (
            <div className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 border text-left">Code</th>
                    <th className="p-3 border text-left">Item</th>
                    <th className="p-3 border text-left">Requester</th>
                    <th className="p-3 border text-left">Dates</th>
                    <th className="p-3 border text-left">Reason</th>
                    <th className="p-3 border text-left">Status</th>
                    <th className="p-3 border text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {shownRequests.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 border">{r.equipment_code}</td>
                      <td className="p-3 border">{r.item_name}</td>
                      <td className="p-3 border">
                        {r.requester_name}<br />
                        <span className="text-gray-500">{r.requester_uni} · {r.requester_email}</span>
                      </td>
                      <td className="p-3 border">{r.start_date} {r.start_time} → {r.end_date} {r.end_time}</td>
                      <td className="p-3 border">{r.reason}</td>
                      <td className="p-3 border">{r.status}</td>
                      <td className="p-3 border">
                        {r.status === "pending" && (
                          <div className="flex gap-2">
                            <button onClick={() => approveRequest(r)} className="border px-3 py-1 rounded hover:bg-gray-100">Approve</button>
                            <button onClick={() => declineRequest(r)} className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700">Decline</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function CheckoutTable({
  rows,
  isAdmin,
  returned,
  onEdit,
  onDelete,
  onReturn,
}: {
  rows: Checkout[];
  isAdmin: boolean;
  returned: boolean;
  onEdit: (checkout: Checkout) => void;
  onDelete: (id?: string) => void;
  onReturn: (checkout: Checkout) => void;
}) {
  return (
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
            <th className="p-3 border text-left">Due Return</th>
            {returned && <th className="p-3 border text-left">Actual Return</th>}
            <th className="p-3 border text-left">Notes</th>
            {isAdmin && <th className="p-3 border text-left">Admin</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((checkout) => (
            <tr key={checkout.id}>
              <td className="p-3 border">{checkout.equipment_code}</td>
              <td className="p-3 border">{checkout.renter_name}</td>
              <td className="p-3 border">{checkout.uni}</td>
              <td className="p-3 border">{checkout.email}</td>
              <td className="p-3 border">{checkout.instructor}</td>
              <td className="p-3 border">{checkout.checkout_date}</td>
              <td className="p-3 border">{checkout.return_date}</td>
              {returned && <td className="p-3 border">{checkout.actual_return_date}</td>}
              <td className="p-3 border">{checkout.notes}</td>
              {isAdmin && (
                <td className="p-3 border">
                  <div className="flex gap-2">
                    {!returned && <button onClick={() => onReturn(checkout)} className="border px-3 py-1 rounded hover:bg-gray-100">Return</button>}
                    <button onClick={() => onEdit(checkout)} className="border px-3 py-1 rounded hover:bg-gray-100">Edit</button>
                    <button onClick={() => onDelete(checkout.id)} className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700">Delete</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
