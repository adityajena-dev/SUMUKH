/* ==========================================================================
   SIT — DATA ACCESS LAYER & LOCAL STORAGE (js/data.js)
   Shared reactive state for Business Owner & Customer Storefront
   ========================================================================== */

const SIT_DATA = (function () {
  "use strict";

const STORAGE_KEYS = {
  PRODUCTS: "sit_products_v2",
  CUSTOMERS: "sit_customers_v2",
  ORDERS: "sit_orders_v2",
  STORE_PROFILE: "sit_store_profile_v2",
  CART: "sit_cart_v2",
  AUTH: "sit_owner_auth_v2",
  ACTIVE_CUST_ORDER: "sit_active_cust_order_id_v2",

  // Multi-shop frontend test storage
  SHOPS: "sit_shops_v2",
  ACTIVE_SHOP: "sit_active_shop_v2"
};
  const DEFAULT_STORE_PROFILE = {
    shopId: "",
    shopName: "Store",
    ownerName: "",
    phone: "",
    address: "",
    upiId: "",
    currency: "₹",
    isOpen: true,
    marketArea: "",
    tagline: ""
  };

function getShops() {
  return loadJson(STORAGE_KEYS.SHOPS, []);
}

function saveShops(shops) {
  saveJson(STORAGE_KEYS.SHOPS, shops);
}

function getActiveShopId() {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_SHOP) || "";
}

function setActiveShopId(shopId) {
  if (!shopId) return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SHOP, String(shopId));
  dispatchSyncEvent("active_shop");
}

function getActiveShop() {
  const shops = getShops();
  const shopId = getActiveShopId();

  return shops.find((shop) => shop.shopId === shopId) || null;
}

  function loadJson(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error loading key ${key}:`, e);
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      dispatchSyncEvent(key);
    } catch (e) {
      console.error(`Error saving key ${key}:`, e);
    }
  }

  function dispatchSyncEvent(key) {
    window.dispatchEvent(new CustomEvent("sit:data-sync", { detail: { key } }));
  }

  function initializeIfEmpty() {
  // Local storage should start empty.
  // Shared shop data comes from the backend.

  if (!localStorage.getItem(STORAGE_KEYS.SHOPS)) {
    saveJson(STORAGE_KEYS.SHOPS, []);
  }
}

  function setShopOpenStatus(isOpen) {
    const profile = loadJson(STORAGE_KEYS.STORE_PROFILE, DEFAULT_STORE_PROFILE);
    profile.isOpen = !!isOpen;
    saveJson(STORAGE_KEYS.STORE_PROFILE, profile);
    dispatchSyncEvent("store_profile");
    return profile;
  }

  // Formatting helpers
  const formatCurrency = (val) => "₹" + (Number(val) || 0).toFixed(2);

  function formatDate(isoStr) {
    if (!isoStr) return "";
    const date = new Date(isoStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatTime(isoStr) {
    if (!isoStr) return "";
    const date = new Date(isoStr);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatRelativeTime(isoStr) {
    if (!isoStr) return "";
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return {
    STORAGE_KEYS,
    initializeIfEmpty,
    getProducts: () => getActiveShop()?.products || [],
saveProducts: (products) => {
  const shops = getShops();
  const activeShopId = getActiveShopId();
  const shop = shops.find((item) => item.shopId === activeShopId);

  if (!shop) return;

  shop.products = products;
  saveShops(shops);
  dispatchSyncEvent("products");
},

getCustomers: () => getActiveShop()?.customers || [],
saveCustomers: (customers) => {
  const shops = getShops();
  const activeShopId = getActiveShopId();
  const shop = shops.find((item) => item.shopId === activeShopId);

  if (!shop) return;

  shop.customers = customers;
  saveShops(shops);
  dispatchSyncEvent("customers");
},

getOrders: () => getActiveShop()?.orders || [],
saveOrders: (orders) => {
  const shops = getShops();
  const activeShopId = getActiveShopId();
  const shop = shops.find((item) => item.shopId === activeShopId);

  if (!shop) return;

  shop.orders = orders;
  saveShops(shops);
  dispatchSyncEvent("orders");
},

getStoreProfile: () => {
  const shop = getActiveShop();
  return shop ? { ...shop } : DEFAULT_STORE_PROFILE;
},

saveStoreProfile: (profile) => {
  const shops = getShops();
  const activeShopId = getActiveShopId();
  let shop = shops.find((item) => item.shopId === activeShopId);

  // A server-authenticated shop may not exist in this browser cache yet.
  // Create the local cache entry so the UI can render while API data loads.
  if (!shop) {
    shop = {
      shopId: profile.shopId || activeShopId,
      products: [],
      customers: [],
      orders: []
    };
    shops.push(shop);
  }

  Object.assign(shop, profile);
  saveShops(shops);
  dispatchSyncEvent("store_profile");
},

getShopById: (shopId) => {
  const shops = getShops();

  if (!shopId) {
    return getActiveShop();
  }

  const cleanId = String(shopId).toLowerCase().trim();

  return (
    shops.find(
      (shop) =>
        String(shop.shopId).toLowerCase() === cleanId
    ) || null
  );
},

/* ---------------------------------
   SHOP-SPECIFIC CUSTOMER DATA
---------------------------------- */


getOrdersByShopId: (shopId) => {
  const shop = getShops().find(
    (item) =>
      String(item.shopId).toLowerCase() ===
      String(shopId || "").toLowerCase().trim()
  );

  return shop?.orders || [];
},


getCartByShopId: (shopId) => {
  const key = `sit_cart_${String(shopId || "default")}`;
  return loadJson(key, []);
},

saveCartByShopId: (shopId, cart) => {
  const key = `sit_cart_${String(shopId || "default")}`;
  saveJson(key, cart);
},

setShopOpenStatus,
getActiveShopId,
setActiveShopId,
getShops,
    getOwnerAuth: () => loadJson(
  STORAGE_KEYS.AUTH,
  { isLoggedIn: false, email: "" }
),
    saveOwnerAuth: (a) => saveJson(STORAGE_KEYS.AUTH, a),
    loadJson,
    saveJson,
    formatCurrency,
    formatDate,
    formatTime,
    formatRelativeTime,
    escapeHtml
  };
})();
