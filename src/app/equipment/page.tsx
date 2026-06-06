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
          <p className="text-gray-600 mb-6">Log in with TC/CU Google.</p><button onClick={() => setView("inventory")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Inventory</button>{view === "inventory" && <button onClick={openAddItem} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Add Item</button>}
                {view === "active" && <button onClick={() => openAddCheckout()} className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Add Checkout</button>}
              </>
            )}

            <span className="text-gray-700">
              Logged in as <strong>{user.email}</strong>{isAdmin && <span> · admin</span>}
            </span><button onClick={() => openEditItem(item)} className="border px-3 py-1 rounded hover:bg-gray-100">Edit</button><button onClick={() => declineRequest(r)} className="bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700">Decline</button>
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