"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type EquipmentItem = {
  id?: string;
  inventory_code: string;
  category: string;
  item_name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  location: string;
  status: string;
  notes: string;
};

type Checkout = {
  id?: string;
  equipment_code: string;
  renter_name: string;
  uni: string;
  email: string;
  instructor: string;
  checkout_date: string;
  return_date: string;
  actual_return_date?: string;
  returned?: boolean;
  notes: string;
};

type EquipmentRequest = {
  id?: string;
  equipment_id?: string;
  equipment_code: string;
  item_name: string;
  requester_name: string;
  requester_email: string;
  requester_uni: string;
  phone: string;
  programme: string;
  instructor: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  reason: string;
  status: string;
};

const adminEmails = [
  "hh3144@tc.columbia.edu",
  "jcg21@tc.columbia.edu",
  "instruments@tc.columbia.edu",
  "ma3412@tc.columbia.edu",
];

export default function EquipmentPage() {
  const [user, setUser] = useState<any>(null);

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);

  const [view, setView] = useState<
    "inventory" | "active" | "returned" | "requests"
  >("inventory");

  const [search, setSearch] = useState("");

  const [showRequestModal, setShowRequestModal] = useState(false);

  const [selectedItem, setSelectedItem] =
    useState<EquipmentItem | null>(null);

  const [requestForm, setRequestForm] = useState({
    requester_name: "",
    requester_email: "",
    requester_uni: "",
    phone: "",
    programme: "",
    instructor: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    reason: "",
  });

  const isAdmin =
    user?.email &&
    adminEmails.includes(user.email.toLowerCase());

  useEffect(() => {
    loadData();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  async function loadData() {
    const { data: itemsData } = await supabase
      .from("equipment_items")
      .select("*")
      .order("inventory_code");

    const { data: checkoutData } = await supabase
      .from("equipment_checkouts")
      .select("*")
      .order("checkout_date", { ascending: false });

    const { data: requestData } = await supabase
      .from("equipment_requests")
      .select("*")
      .order("created_at", { ascending: false });

    setItems(itemsData || []);
    setCheckouts(checkoutData || []);
    setRequests(requestData || []);
  }

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
    window.location.reload();
  }

  function itemCheckedOut(code: string) {
    return checkouts.some(
      (c) =>
        c.equipment_code === code &&
        !c.returned
    );
  }

  function openRequestModal(item: EquipmentItem) {
    setSelectedItem(item);

    setRequestForm({
      requester_name: "",
      requester_email: user?.email || "",
      requester_uni:
        user?.email?.split("@")[0] || "",
      phone: "",
      programme: "",
      instructor: "",
      start_date: "",
      start_time: "",
      end_date: "",
      end_time: "",
      reason: "",
    });

    setShowRequestModal(true);
  }

  async function submitRequest() {
    if (!selectedItem) return;

    const payload = {
      equipment_id: selectedItem.id,
      equipment_code:
        selectedItem.inventory_code,
      item_name: selectedItem.item_name,
      ...requestForm,
      status: "pending",
    };

    const { error } = await supabase
      .from("equipment_requests")
      .insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    await fetch("/api/equipment-request-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        equipmentCode:
          selectedItem.inventory_code,
        itemName: selectedItem.item_name,
        requesterName:
          requestForm.requester_name,
        requesterUni:
          requestForm.requester_uni,
        requesterEmail:
          requestForm.requester_email,
        phone: requestForm.phone,
        programme: requestForm.programme,
        instructor:
          requestForm.instructor,
        startDate:
          requestForm.start_date,
        startTime:
          requestForm.start_time,
        endDate: requestForm.end_date,
        endTime: requestForm.end_time,
        reason: requestForm.reason,
      }),
    });

    alert("Request submitted.");

    setShowRequestModal(false);

    loadData();
  }

  async function approveRequest(
    request: EquipmentRequest
  ) {
    const { error } = await supabase
      .from("equipment_checkouts")
      .insert({
        equipment_code:
          request.equipment_code,
        renter_name:
          request.requester_name,
        uni: request.requester_uni,
        email: request.requester_email,
        instructor:
          request.instructor,
        checkout_date:
          request.start_date,
        return_date:
          request.end_date,
        returned: false,
        notes: request.reason,
      });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("equipment_requests")
      .update({
        status: "approved",
      })
      .eq("id", request.id);

    loadData();
  }

  async function returnCheckout(
    checkout: Checkout
  ) {
    const actualDate = prompt(
      "Return date:",
      new Date().toISOString().split("T")[0]
    );

    if (!actualDate) return;

    await supabase
      .from("equipment_checkouts")
      .update({
        returned: true,
        actual_return_date:
          actualDate,
      })
      .eq("id", checkout.id);

    loadData();
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-lg border max-w-lg w-full">
          <h1 className="text-4xl font-bold mb-4">
            Equipment Inventory
          </h1>

          <button
            onClick={login}
            className="bg-black text-white px-4 py-3 rounded-lg w-full"
          >
            Continue with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">

        <div className="mb-8">
          <h1 className="text-5xl font-bold">
            Equipment Inventory
          </h1>

          <p className="text-gray-600 mt-2">
            Inventory: {items.length} items ·
            Active Rentals: {
              checkouts.filter(
                (c) => !c.returned
              ).length
            }
          </p>
        </div>

        <div className="bg-white border rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center">

          <button
            onClick={() =>
              setView("inventory")
            }
            className="border px-4 py-2 rounded-lg"
          >
            Inventory
          </button>

          <button
            onClick={() =>
              setView("active")
            }
            className="border px-4 py-2 rounded-lg"
          >
            Active Renting
          </button>

          <button
            onClick={() =>
              setView("returned")
            }
            className="border px-4 py-2 rounded-lg"
          >
            Returned
          </button>

          {isAdmin && (
            <button
              onClick={() =>
                setView("requests")
              }
              className="border px-4 py-2 rounded-lg"
            >
              Requests
            </button>
          )}

          <input
            placeholder="Search..."
            className="border px-4 py-2 rounded-lg ml-auto"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <button
            onClick={logout}
            className="border px-4 py-2 rounded-lg"
          >
            Log out
          </button>
        </div>

        {view === "inventory" && (
          <div className="bg-white rounded-2xl border shadow-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3 text-left">
                    Code
                  </th>
                  <th className="border p-3 text-left">
                    Category
                  </th>
                  <th className="border p-3 text-left">
                    Item
                  </th>
                  <th className="border p-3 text-left">
                    Location
                  </th>
                  <th className="border p-3 text-left">
                    Status
                  </th>
                  <th className="border p-3 text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items
                  .filter((item) =>
                    JSON.stringify(item)
                      .toLowerCase()
                      .includes(
                        search.toLowerCase()
                      )
                  )
                  .map((item) => {
                    const checked =
                      itemCheckedOut(
                        item.inventory_code
                      );

                    return (
                      <tr key={item.id}>
                        <td className="border p-3">
                          {
                            item.inventory_code
                          }
                        </td>

                        <td className="border p-3">
                          {item.category}
                        </td>

                        <td className="border p-3">
                          {item.item_name}
                        </td>

                        <td className="border p-3">
                          {item.location}
                        </td>

                        <td className="border p-3">
                          {checked
                            ? "Checked Out"
                            : "Available"}
                        </td>

                        <td className="border p-3">
                          {!checked && (
                            <button
                              onClick={() =>
                                openRequestModal(
                                  item
                                )
                              }
                              className="border px-3 py-1 rounded"
                            >
                              Request
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {view === "active" && (
          <div className="bg-white rounded-2xl border shadow-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3">
                    Equipment
                  </th>
                  <th className="border p-3">
                    Name
                  </th>
                  <th className="border p-3">
                    UNI
                  </th>
                  <th className="border p-3">
                    Checkout
                  </th>
                  <th className="border p-3">
                    Return
                  </th>
                  {isAdmin && (
                    <th className="border p-3">
                      Admin
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {checkouts
                  .filter((c) => !c.returned)
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="border p-3">
                        {c.equipment_code}
                      </td>

                      <td className="border p-3">
                        {c.renter_name}
                      </td>

                      <td className="border p-3">
                        {c.uni}
                      </td>

                      <td className="border p-3">
                        {c.checkout_date}
                      </td>

                      <td className="border p-3">
                        {c.return_date}
                      </td>

                      {isAdmin && (
                        <td className="border p-3">
                          <button
                            onClick={() =>
                              returnCheckout(c)
                            }
                            className="border px-3 py-1 rounded"
                          >
                            Return
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "returned" && (
          <div className="bg-white rounded-2xl border shadow-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3">
                    Equipment
                  </th>
                  <th className="border p-3">
                    Name
                  </th>
                  <th className="border p-3">
                    Returned
                  </th>
                </tr>
              </thead>

              <tbody>
                {checkouts
                  .filter((c) => c.returned)
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="border p-3">
                        {c.equipment_code}
                      </td>

                      <td className="border p-3">
                        {c.renter_name}
                      </td>

                      <td className="border p-3">
                        {
                          c.actual_return_date
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "requests" &&
          isAdmin && (
            <div className="bg-white rounded-2xl border shadow-lg overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-3">
                      Equipment
                    </th>
                    <th className="border p-3">
                      Name
                    </th>
                    <th className="border p-3">
                      UNI
                    </th>
                    <th className="border p-3">
                      Dates
                    </th>
                    <th className="border p-3">
                      Reason
                    </th>
                    <th className="border p-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="border p-3">
                        {r.equipment_code}
                      </td>

                      <td className="border p-3">
                        {r.requester_name}
                      </td>

                      <td className="border p-3">
                        {r.requester_uni}
                      </td>

                      <td className="border p-3">
                        {r.start_date} →{" "}
                        {r.end_date}
                      </td>

                      <td className="border p-3">
                        {r.reason}
                      </td>

                      <td className="border p-3">
                        {r.status !==
                          "approved" && (
                          <button
                            onClick={() =>
                              approveRequest(
                                r
                              )
                            }
                            className="border px-3 py-1 rounded"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {showRequestModal &&
          selectedItem && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

              <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">

                <h2 className="text-2xl font-bold mb-4">
                  Equipment Request
                </h2>

                <div className="grid grid-cols-2 gap-3">

                  <input
                    placeholder="Name"
                    className="border p-2 rounded"
                    value={
                      requestForm.requester_name
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        requester_name:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="UNI"
                    className="border p-2 rounded"
                    value={
                      requestForm.requester_uni
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        requester_uni:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Email"
                    className="border p-2 rounded"
                    value={
                      requestForm.requester_email
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        requester_email:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Phone"
                    className="border p-2 rounded"
                    value={
                      requestForm.phone
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        phone:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Programme"
                    className="border p-2 rounded"
                    value={
                      requestForm.programme
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        programme:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Instructor"
                    className="border p-2 rounded"
                    value={
                      requestForm.instructor
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        instructor:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    type="date"
                    className="border p-2 rounded"
                    value={
                      requestForm.start_date
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        start_date:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    type="time"
                    className="border p-2 rounded"
                    value={
                      requestForm.start_time
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        start_time:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    type="date"
                    className="border p-2 rounded"
                    value={
                      requestForm.end_date
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        end_date:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    type="time"
                    className="border p-2 rounded"
                    value={
                      requestForm.end_time
                    }
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        end_time:
                          e.target.value,
                      })
                    }
                  />

                </div>

                <textarea
                  placeholder="Reason"
                  className="border p-2 rounded w-full mt-3"
                  value={
                    requestForm.reason
                  }
                  onChange={(e) =>
                    setRequestForm({
                      ...requestForm,
                      reason:
                        e.target.value,
                    })
                  }
                />

                <div className="flex justify-end gap-2 mt-4">

                  <button
                    onClick={() =>
                      setShowRequestModal(
                        false
                      )
                    }
                    className="border px-4 py-2 rounded"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={submitRequest}
                    className="bg-black text-white px-4 py-2 rounded"
                  >
                    Submit Request
                  </button>

                </div>

              </div>

            </div>
          )}

      </div>
    </main>
  );
}
