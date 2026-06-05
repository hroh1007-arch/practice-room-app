"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type EquipmentItem = {
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
  created_at?: string | null;
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

const emptyItem: EquipmentItem = {
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
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [view, setView] = useState<"inventory" | "active" | "returned" | "requests">("inventory");
  const [search, setSearch] = useState("");

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem>(emptyItem);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [editingCheckout, setEditingCheckout] = useState<Checkout>(emptyCheckout);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestItemData, setRequestItemData] = useState<EquipmentItem | null>(null);
  const [requestForm, setRequestForm] = useState({
    name: "",
    uni: "",
    email: "",
    phone: "",
    programme: "",
    instructor: "",
    startDate: today(),
    startTime: "09:00",
    endDate: today(),
    endTime: "17:00",
    reason: "",
  });

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

    const { data: itemData, error: itemError } = await supabase
      .from("equipment_items")
      .select("*")
      .order("category", { ascending: true })
      .order("inventory_code", { ascending: true });

    if (itemError) alert("Equipment load error: " + itemError.message);
    setItems(itemData || []);

    const { data: checkoutData, error: checkoutError } = await supabase
      .from("equipment_checkouts")
      .select("*")
      .order("checkout_date", { ascending: false });

    if (checkoutError) alert("Checkout load error: " + checkoutError.message);
    setCheckouts(checkoutData || []);

    const { data: requestData, error: requestError } = await supabase
      .from("equipment_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestError) alert("Request load error: " + requestError.message);
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
      options: {
        redirectTo: window.location.origin + "/equipment",
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function matchesSearch(values: Array<string | null | undefined>) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();

    return values.some((value) =>
      String(value || "").toLowerCase().includes(q)
    );
  }

  const activeEquipmentCodes = new Set(
    checkouts
      .filter((c) => !c.returned)
      .map((c) => String(c.equipment_code || "").toLowerCase())
  );

  const activeCheckouts = checkouts.filter((c) => !c.returned);
  const returnedCheckouts = checkouts.filter((c) => c.returned);

  const shownItems = items.filter((item) =>
    matchesSearch([
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

  const shownActive = activeCheckouts.filter((c) =>
    matchesSearch([
      c.equipment_code,
      c.renter_name,
      c.uni,
      c.email,
     
