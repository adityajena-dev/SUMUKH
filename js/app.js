/* ==========================================================================
   SIT — APPLICATION INITIALIZER & SHARED UTILS (js/app.js)
   Toast notifications, demo mode bar, page initializers
   ========================================================================== */

const SIT_APP = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function showToast(message, type = "default") {
    const container = $("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  function bindSharedEvents() {

    // Cross-tab synchronization
    window.addEventListener("storage", () => {
      window.dispatchEvent(new CustomEvent("sit:data-sync", { detail: { key: "storage-event" } }));
    });
  }

  function initOwnerPage() {
    SIT_DATA.initializeIfEmpty();
    bindSharedEvents();
    SIT_BILL.bindEvents();
    SIT_OWNER.init();
  }

  function initShopPage() {
    SIT_DATA.initializeIfEmpty();
    bindSharedEvents();
    SIT_BILL.bindEvents();
    SIT_CUSTOMER.init();
  }

  return {
    showToast,
    initOwnerPage,
    initShopPage
  };
})();
