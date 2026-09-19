/* ==========================================================================
   SIT — BUSINESS OWNER LOGIC (js/owner.js)
   Dashboard, 4 metrics, multi-item order creator, products, CRM, sales
   ========================================================================== */

const SIT_OWNER = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const API_BASE_URL = SUMUKH_CONFIG.API_BASE_URL;

  let activeOrderFilter = "all";
let activeSalesFilter = "today";
let manualOrderRows = [];
let currentOwnerView = "view-dashboard";

  /* -----------------------------
     AUTH
  ----------------------------- */
  function checkAuth() {
    const auth = SIT_DATA.getOwnerAuth();
    const authView = $("owner-auth-view");
    const workspace = $("owner-workspace");
    if (!authView || !workspace) return;

    if (auth && auth.isLoggedIn) {
      authView.hidden = true;
      workspace.hidden = false;
      renderAll();
    } else {
      workspace.hidden = true;
      authView.hidden = false;
    }
  }

  function switchView(targetViewId) {
    currentOwnerView = targetViewId;

    if ($("owner-more-modal")) {
      $("owner-more-modal").hidden = true;
    }

    const views = document.querySelectorAll(".owner-view");
    views.forEach((v) => {
      v.hidden = v.id !== targetViewId;
      v.classList.toggle("active", v.id === targetViewId);
    });

    document.querySelectorAll(".sidebar-nav .nav-item").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.ownerView === targetViewId
      );
    });

    document
      .querySelectorAll(".owner-bottom-nav .bottom-nav-item")
      .forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.dataset.ownerView === targetViewId
        );
      });

    const moreViews = [
      "view-customers",
      "view-sales",
      "view-bills",
      "view-myshop",
      "view-settings"
    ];
    const moreBtn = $("btn-owner-more");
    if (moreBtn) {
      moreBtn.classList.toggle("active", moreViews.includes(targetViewId));
    }

    document.querySelectorAll(".more-menu-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.ownerView === targetViewId
      );
    });

    syncOwnerData().then(() => {
      if (targetViewId === "view-dashboard") {
        renderDashboard();
      } else if (targetViewId === "view-orders") {
        renderOrders();
      } else if (targetViewId === "view-products") {
        renderProducts();
      } else if (targetViewId === "view-new-order") {
        setupManualOrderForm();
      } else if (targetViewId === "view-sales") {
        renderSales();
      } else if (targetViewId === "view-customers") {
        renderCustomers();
      } else if (targetViewId === "view-bills") {
        renderBills();
      } else if (targetViewId === "view-myshop") {
        renderMyShop();
      } else if (targetViewId === "view-settings") {
        renderSettings();
      }
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* -----------------------------
     BACKEND SYNC FOR ACTIVE SHOP
  ----------------------------- */
  async function syncOwnerData() {
    const profile = SIT_DATA.getStoreProfile();
    if (!profile || !profile.shopId) return;

    try {
      const [ordersRes, productsRes, customersRes, shopRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/orders`),
        fetch(`${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/products`),
        fetch(`${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/customers`),
        fetch(`${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}`)
      ]);

      if (ordersRes.ok) {
        const orders = await ordersRes.json();
        if (Array.isArray(orders)) {
          SIT_DATA.saveOrders(orders);
        }
      }

      if (productsRes.ok) {
        const products = await productsRes.json();
        if (Array.isArray(products)) {
          SIT_DATA.saveProducts(products);
        }
      }
      if (customersRes.ok) {
        const customers = await customersRes.json();
        if (Array.isArray(customers)) SIT_DATA.saveCustomers(customers);
      }
      if (shopRes.ok) {
        const result = await shopRes.json();
        if (result.shop) SIT_DATA.saveStoreProfile(result.shop);
      }
    } catch (err) {
      console.warn("Unable to sync owner data from server, using local cache:", err);
    }
  }

  /* -----------------------------
     ORDERS RED NOTIFICATION BADGE
  ----------------------------- */
  function updateOrdersBadge() {
    const orders = SIT_DATA.getOrders();
    const unfinishedOrders = orders.filter(
      (o) => !["completed", "cancelled"].includes(o.status)
    );
    const count = unfinishedOrders.length;

    // Desktop sidebar badge
    const desktopBadge = $("nav-badge-orders");
    if (desktopBadge) {
      desktopBadge.textContent = count;
      desktopBadge.style.display = count > 0 ? "inline-block" : "none";
    }

    // Mobile bottom nav badge
    const mobileBadge = $("mobile-badge-orders");
    if (mobileBadge) {
      mobileBadge.style.display = count > 0 ? "block" : "none";
    }
  }

  /* -----------------------------
     DASHBOARD (4 CARDS + ACTIONS)
  ----------------------------- */
  function renderDashboard() {
    const orders = SIT_DATA.getOrders();
    const profile = SIT_DATA.getStoreProfile();

    if ($("sidebar-shop-name")) $("sidebar-shop-name").textContent = profile.shopName;
    if ($("mobile-shop-name")) $("mobile-shop-name").textContent = profile.shopName;

    if ($("dashboard-date-str")) {
      $("dashboard-date-str").textContent = new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }

    const todayDateStr = new Date().toDateString();

    const newOrders = orders.filter((o) => o.status === "received");
    const preparingOrders = orders.filter((o) => o.status === "preparing" || o.status === "accepted");
    const completedOrders = orders.filter((o) => o.status === "completed");
    const salesToday = orders
  .filter(
    (o) =>
      o.paymentStatus === "paid" &&
      o.status !== "cancelled" &&
      new Date(o.completedAt || o.createdAt).toDateString() === todayDateStr
  )
  .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    if ($("stat-orders-new")) $("stat-orders-new").textContent = newOrders.length;
    if ($("stat-orders-preparing")) $("stat-orders-preparing").textContent = preparingOrders.length;
    if ($("stat-orders-completed")) $("stat-orders-completed").textContent = completedOrders.length;
    if ($("stat-sales-today")) $("stat-sales-today").textContent = SIT_DATA.formatCurrency(salesToday);

    // Unfinished Orders Badge Indicator
    updateOrdersBadge();

    // Active Orders List (needing attention: received, accepted, preparing, ready)
    const activeOrders = orders.filter((o) => ["received", "accepted", "preparing", "ready"].includes(o.status));
    const container = $("dashboard-active-orders");
    if (!container) return;
    container.innerHTML = "";

if (activeOrders.length === 0) {
  container.innerHTML = `
    <div class="card empty-state dashboard-empty-orders">
      <div class="empty-state-icon">
        <i data-lucide="party-popper"></i>
      </div>

      <p class="text-muted">
        All caught up! No active orders awaiting action.
      </p>
    </div>
  `;

  if (window.lucide) {
    lucide.createIcons();
  }

  return;
}

    const sorted = [...activeOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sorted.slice(0, 4).forEach((order) => {
      container.appendChild(createOrderCardElement(order));
    });
  }

  /* -----------------------------
     ORDERS LIFECYCLE MANAGEMENT
  ----------------------------- */
function renderOrders() {
  const orders = SIT_DATA.getOrders();
  const listContainer = $("orders-lifecycle-list");

  if (!listContainer) return;

  listContainer.innerHTML = "";

  /* -----------------------------
     FILTER COUNTS
  ----------------------------- */

  if ($("count-filter-all")) {
  $("count-filter-all").textContent =
    orders.filter(
      (o) => !["completed", "cancelled"].includes(o.status)
    ).length;
}

  if ($("count-filter-new")) {
    $("count-filter-new").textContent =
      orders.filter((o) => o.status === "received").length;
  }

  if ($("count-filter-preparing")) {
    $("count-filter-preparing").textContent =
      orders.filter(
        (o) => o.status === "preparing" || o.status === "accepted"
      ).length;
  }

  if ($("count-filter-ready")) {
    $("count-filter-ready").textContent =
      orders.filter((o) => o.status === "ready").length;
  }

  if ($("count-filter-completed")) {
    $("count-filter-completed").textContent =
      orders.filter((o) => o.status === "completed").length;
  }

  if ($("count-filter-cancelled")) {
    $("count-filter-cancelled").textContent =
      orders.filter((o) => o.status === "cancelled").length;
  }

  /* -----------------------------
     FILTER ORDERS
  ----------------------------- */

  let filtered = orders;

if (activeOrderFilter === "all") {
  filtered = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  );
}

if (activeOrderFilter === "received") {
  filtered = orders.filter(
    (o) => o.status === "received"
  );
}

if (activeOrderFilter === "preparing") {
  filtered = orders.filter(
    (o) =>
      o.status === "preparing" ||
      o.status === "accepted"
  );
}

if (activeOrderFilter === "ready") {
  filtered = orders.filter(
    (o) => o.status === "ready"
  );
}

if (activeOrderFilter === "completed") {
  filtered = orders.filter(
    (o) => o.status === "completed"
  );
}

if (activeOrderFilter === "cancelled") {
  filtered = orders.filter(
    (o) => o.status === "cancelled"
  );
}

  /* -----------------------------
     EMPTY STATE
  ----------------------------- */

if (filtered.length === 0) {
  listContainer.innerHTML = `
    <div class="card empty-state orders-empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">
          <i data-lucide="clipboard-list"></i>
        </div>

        <div>
          <h3>No orders found</h3>
          <p>No orders match this status filter.</p>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  return;
}

  /* -----------------------------
     SORT + RENDER
  ----------------------------- */

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  sorted.forEach((order) => {
    listContainer.appendChild(createOrderCardElement(order));
  });

  updateOrdersBadge();
}

function createOrderCardElement(order) {
  const card = document.createElement("article");
  card.className = "order-card";

  /* -----------------------------
     ORDER ITEMS
  ----------------------------- */

  const itemsSummary = (order.items || [])
    .map(
      (item) => `
        <div class="order-item-line">
          <span>${SIT_DATA.escapeHtml(item.name)}</span>

          <span class="order-item-qty">
            × ${item.quantity}
            <strong>
              ${SIT_DATA.formatCurrency(
  Number(item.total ?? (Number(item.price) * Number(item.quantity))) || 0
)}
            </strong>
          </span>
        </div>
      `
    )
    .join("");

  /* -----------------------------
     ACTION BUTTONS
  ----------------------------- */

  let actionBtns = "";

  /*
     NEW → PREPARING
  */

  if (order.status === "received") {
    actionBtns = `
      <button
  type="button"
  class="btn btn-primary btn-xs btn-advance-status"
        data-next-status="preparing"
        data-order-id="${order.id}">
        Accept & Prepare
      </button>

      <button
      type="button"
        class="btn btn-ghost btn-xs text-danger btn-cancel-order"
        data-order-id="${order.id}"
      >
        Cancel
      </button>
    `;
  }

  /*
     PREPARING → READY

     "accepted" is kept here only for
     old demo data compatibility.
  */

  else if (
    order.status === "preparing" ||
    order.status === "accepted"
  ) {
    actionBtns = `
      <button
        type="button"
        class="btn btn-primary btn-xs btn-advance-status"
        data-order-id="${order.id}"
        data-next-status="ready"
      >
        Mark Ready
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs text-danger btn-cancel-order"
        data-order-id="${order.id}"
      >
        Cancel
      </button>
    `;
  }

  /*
     READY → COMPLETED
  */

  else if (order.status === "ready") {
    actionBtns = `
      <button
        type="button"
        class="btn btn-primary btn-xs btn-advance-status"
        data-order-id="${order.id}"
        data-next-status="completed"
      >
        Complete Order
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs text-danger btn-cancel-order"
        data-order-id="${order.id}"
      >
        Cancel
      </button>
    `;
  }

  /*
     BILL
  */

  actionBtns += `
    <button
  type="button"
  class="btn btn-outline btn-xs btn-view-bill"
  data-order-id="${order.id}"
>
  Bill & QR
</button>
  `;

  /* -----------------------------
     DISPLAY STATUS
  ----------------------------- */

  let displayStatus = order.status;

  if (order.status === "received") {
    displayStatus = "New";
  }

  if (order.status === "accepted") {
    displayStatus = "Preparing";
  }

  if (order.status === "preparing") {
    displayStatus = "Preparing";
  }

  if (order.status === "ready") {
    displayStatus = "Ready";
  }

  if (order.status === "completed") {
    displayStatus = "Completed";
  }

  if (order.status === "cancelled") {
    displayStatus = "Cancelled";
  }

  /* -----------------------------
     ORDER CARD
  ----------------------------- */

  card.innerHTML = `
    <div class="order-card-header">

      <div class="order-id-block">

        <span class="order-id">
          #${order.id}
        </span>

        <span class="status-pill status-${order.status}">
          ${displayStatus}
        </span>

        <span class="pay-status-pill pay-status-${order.paymentStatus}" style="margin-left: 6px;">
          ${order.paymentStatus === "paid" ? "PAID" : "PENDING"}
        </span>

      </div>

    </div>

    <div class="order-customer-box">

      <div>

        <div class="order-cust-name">
          ${SIT_DATA.escapeHtml(order.customerName)}
        </div>

        <div class="order-cust-phone">
          ${SIT_DATA.escapeHtml(order.customerPhone || "N/A")}
        </div>

      </div>

    </div>

    <div class="order-items-box">

      <div class="order-items-heading">
        Items
      </div>

      ${itemsSummary}

    </div>

    <div class="order-card-footer">

      <span class="order-total-price">
        Total: ${SIT_DATA.formatCurrency(order.total)}
      </span>

      <div class="order-actions-group">
        ${actionBtns}
      </div>

    </div>
  `;

  /* -----------------------------
     STATUS ACTIONS
  ----------------------------- */

  card
    .querySelectorAll(".btn-advance-status")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  advanceStatus(
    Number(button.dataset.orderId),
    button.dataset.nextStatus
  );
});
    });

  /* -----------------------------
     CANCEL
  ----------------------------- */

  card
    .querySelectorAll(".btn-cancel-order")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        cancelOrder(
          Number(button.dataset.orderId)
        );
      });
    });

  /* -----------------------------
     BILL
  ----------------------------- */

  card
    .querySelectorAll(".btn-view-bill")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  SIT_BILL.open(
    Number(button.dataset.orderId)
  );
});
    });

  return card;
}

  async function advanceStatus(orderId, nextStatus) {
  const profile = SIT_DATA.getStoreProfile();
  const orders = SIT_DATA.getOrders();
  const order = orders.find((o) => o.id === orderId);

  if (!order) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: nextStatus
        })
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Unable to update order status (${response.status})`
      );
    }

    if (!data.order) {
      throw new Error("Server did not return the updated order.");
    }

    const idx = orders.findIndex(
      (o) => o.id === orderId
    );

    if (idx !== -1) {
      orders[idx] = data.order;
    }

    SIT_DATA.saveOrders(orders);

    SIT_APP?.showToast?.(
      `Order #${orderId} marked as ${nextStatus}.`,
      "success"
    );

    updateOrdersBadge();

    if (currentOwnerView === "view-dashboard") {
      renderDashboard();
    } else if (currentOwnerView === "view-orders") {
      renderOrders();
    }

  } catch (err) {
    console.error("Could not update order status:", err);

    SIT_APP?.showToast?.(
      err.message ||
      "Unable to update order status. Please try again.",
      "error"
    );

    // IMPORTANT:
    // Do not modify or save the local order when the server update fails.
  }
}

  async function cancelOrder(orderId) {
  if (!confirm(`Cancel Order #${orderId}?`)) return;

  const profile = SIT_DATA.getStoreProfile();
  const orders = SIT_DATA.getOrders();
  const order = orders.find((o) => o.id === orderId);

  if (!order) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "cancelled"
        })
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Unable to cancel order (${response.status})`
      );
    }

    if (!data.order) {
      throw new Error("Server did not return the cancelled order.");
    }

    const idx = orders.findIndex(
      (o) => o.id === orderId
    );

    if (idx !== -1) {
      orders[idx] = data.order;
    }

    SIT_DATA.saveOrders(orders);

    SIT_APP?.showToast?.(
      `Order #${orderId} cancelled.`,
      "error"
    );

    updateOrdersBadge();

    if (currentOwnerView === "view-dashboard") {
      renderDashboard();
    } else if (currentOwnerView === "view-orders") {
      renderOrders();
    }

  } catch (err) {
    console.error("Could not cancel order:", err);

    SIT_APP?.showToast?.(
      err.message ||
      "Unable to cancel order. Please try again.",
      "error"
    );

    // Do not modify/save the local order on failure.
  }
}

  /* -----------------------------
     MANUAL ORDER CUSTOMER MODE UI
  ----------------------------- */
  function updateCustomerModeUI() {
    const modeRadio = document.querySelector("input[name='customer-mode']:checked");
    const isNew = modeRadio ? modeRadio.value === "new" : false;
    const groupExisting = $("group-existing-customer");
    const groupNew = $("group-new-customer");
    const summaryBox = $("selected-customer-summary");

    if (groupExisting) groupExisting.hidden = isNew;
    if (groupNew) groupNew.hidden = !isNew;

    if (isNew) {
      if (summaryBox) summaryBox.hidden = true;
      const selectCust = $("select-customer");
      if (selectCust) selectCust.value = "";
    } else {
      if ($("manual-cust-name")) $("manual-cust-name").value = "";
      if ($("manual-cust-phone")) $("manual-cust-phone").value = "";
      if ($("manual-cust-address")) $("manual-cust-address").value = "";

      const selectCust = $("select-customer");
      const custId = Number(selectCust?.value);
      if (!custId && summaryBox) {
        summaryBox.hidden = true;
      }
    }
  }

  /* -----------------------------
     MANUAL MULTI-PRODUCT ORDER
  ----------------------------- */
  function setupManualOrderForm() {
    const selectCustomer = $("select-customer");
    const customers = SIT_DATA.getCustomers();

    if (!selectCustomer) return;

    /* -----------------------------
       CUSTOMER MODE UI (MUTUALLY EXCLUSIVE)
    ----------------------------- */
    updateCustomerModeUI();

  /* -----------------------------
     LOAD CUSTOMERS
  ----------------------------- */
  selectCustomer.innerHTML =
    `<option value="">-- Choose a registered customer --</option>`;

  customers.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.phone})`;
    selectCustomer.appendChild(opt);
  });

  /* -----------------------------
     START WITH ONE EMPTY PRODUCT ROW
  ----------------------------- */
  manualOrderRows = [
  { id: Date.now(), productId: null, quantity: 1 }
];

  renderManualOrderItemsTable();
  updateManualOrderSummary();
}

function renderManualOrderItemsTable() {
  const tbody = $("order-items-tbody");
  const products = SIT_DATA.getProducts();

  if (!tbody) return;

  tbody.innerHTML = "";

  manualOrderRows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const currentProd = products.find(
      (p) => p.id === Number(row.productId)
    );

    const unitPrice = currentProd
      ? Number(currentProd.price)
      : 0;

    const quantity = Number(row.quantity) || 1;

    const subtotal = unitPrice * quantity;

    const selectedProductIds = manualOrderRows
  .map((item) => Number(item.productId))
  .filter(Number.isFinite);

const productOptionsHtml = `
  <option value="">-- Select Product --</option>

  ${products
    .map((p) => {
      const productId = Number(p.id);

      const selected =
        productId === Number(row.productId);

      const alreadyUsedElsewhere =
        selectedProductIds.includes(productId) && !selected;

      return `
        <option
          value="${productId}"
          ${selected ? "selected" : ""}
          ${alreadyUsedElsewhere ? "disabled" : ""}
        >
          ${SIT_DATA.escapeHtml(p.name)}
          (${SIT_DATA.formatCurrency(p.price)})
        </option>
      `;
    })
    .join("")}
`;

    tr.innerHTML = `
      <td
        class="product-cell"
        data-label="Product"
      >
        <div class="product-selector-wrap">

          <select
            class="form-select row-product-select"
            data-row-idx="${index}"
          >
            ${productOptionsHtml}
          </select>

          <div class="selected-product-name">
            ${
              currentProd
                ? SIT_DATA.escapeHtml(currentProd.name)
                : "No product selected"
            }
          </div>

        </div>
      </td>

      <td
        class="row-price-cell"
        data-label="Price"
      >
        <span class="row-price-label">
          ${
            currentProd
              ? SIT_DATA.formatCurrency(unitPrice)
              : "—"
          }
        </span>
      </td>

      <td
        class="row-qty-cell"
        data-label="Qty"
      >
        <input
          type="number"
          min="1"
          step="1"
          class="row-qty-input item-qty-input"
          data-row-idx="${index}"
          value="${quantity}"
        >
      </td>

      <td
        class="row-subtotal-cell"
        data-label="Subtotal"
      >
        <span class="row-subtotal-label">
          ${
            currentProd
              ? SIT_DATA.formatCurrency(subtotal)
              : "—"
          }
        </span>
      </td>

      <td
        class="row-remove-cell"
        data-label=""
      >
        ${
          manualOrderRows.length > 1
            ? `
              <button
                type="button"
                class="btn-remove-row"
                data-row-idx="${index}"
                aria-label="Remove product"
                title="Remove product"
              >
                ×
              </button>
            `
            : ""
        }
      </td>
    `;

    tbody.appendChild(tr);
  });

  /* -----------------------------
     PRODUCT SELECTION
  ----------------------------- */

  tbody
    .querySelectorAll(".row-product-select")
    .forEach((select) => {
      select.addEventListener("change", (e) => {
        const index = Number(e.target.dataset.rowIdx);

        manualOrderRows[index].productId = e.target.value
          ? Number(e.target.value)
          : null;

        renderManualOrderItemsTable();
        updateManualOrderSummary();
      });
    });

  /* -----------------------------
     QUANTITY CHANGE
  ----------------------------- */

  tbody
    .querySelectorAll(".row-qty-input")
    .forEach((input) => {
      input.addEventListener("input", (e) => {
        const index = Number(e.target.dataset.rowIdx);

        const value = Math.max(
          1,
          parseInt(e.target.value, 10) || 1
        );

        manualOrderRows[index].quantity = value;

        const product = products.find(
          (p) =>
            p.id ===
            Number(manualOrderRows[index].productId)
        );

        const subtotalCell = e.target
          .closest("tr")
          ?.querySelector(".row-subtotal-label");

        if (subtotalCell) {
          subtotalCell.textContent = product
            ? SIT_DATA.formatCurrency(
                Number(product.price) * value
              )
            : "—";
        }

        updateManualOrderSummary();
      });
    });

  /* -----------------------------
     REMOVE PRODUCT ROW
  ----------------------------- */

  tbody
    .querySelectorAll(".btn-remove-row")
    .forEach((button) => {
      button.addEventListener("click", (e) => {
        const index = Number(
          e.currentTarget.dataset.rowIdx
        );

        manualOrderRows.splice(index, 1);

        renderManualOrderItemsTable();
        updateManualOrderSummary();
      });
    });
}

  function updateManualOrderSummary() {
    const products = SIT_DATA.getProducts();
    let totalItems = 0;
    let subtotal = 0;

    manualOrderRows.forEach((row) => {
      const prod = products.find((p) => p.id === Number(row.productId));
      if (prod) {
        const q = Number(row.quantity) || 1;
        totalItems += q;
        subtotal += prod.price * q;
      }
    });

    if ($("calc-items-count")) $("calc-items-count").textContent = `${totalItems} items (${manualOrderRows.length} lines)`;
    if ($("calc-subtotal")) $("calc-subtotal").textContent = SIT_DATA.formatCurrency(subtotal);
    if ($("calc-grand-total")) $("calc-grand-total").textContent = SIT_DATA.formatCurrency(subtotal);
  }

  async function handleManualOrderSubmit(e) {
    e.preventDefault();
    const profile = SIT_DATA.getStoreProfile();
    const products = SIT_DATA.getProducts();
    const customers = SIT_DATA.getCustomers();
    const orders = SIT_DATA.getOrders();

    const modeRadio = document.querySelector("input[name='customer-mode']:checked");
    const isNew = modeRadio && modeRadio.value === "new";

    let customerId = null;
let custName = "";
let custPhone = "";
let custAddress = "";

    if (isNew) {
      custName = $("manual-cust-name").value.trim();
      custPhone = $("manual-cust-phone").value.trim();
      custAddress = $("manual-cust-address").value.trim();

      if (!custName || !custPhone || !custAddress) {
        SIT_APP?.showToast?.("Please enter customer name, phone, and address.", "error");
        return;
      }

      try {
  const response = await fetch(
    `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/customers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
  name: custName,
  phone: custPhone,
  address: custAddress
})
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not save customer.");
  }

  customers.push(data.customer);
  SIT_DATA.saveCustomers(customers);

  customerId = data.customer.id;
} catch (error) {
  SIT_APP?.showToast?.(
    error.message || "Unable to save customer.",
    "error"
  );
  return;
}

    } else {
      const selectedId = Number($("select-customer").value);
      if (!selectedId) {
        SIT_APP?.showToast?.("Please choose a customer or switch to '+ New Customer'.", "error");
        return;
      }
      const existing = customers.find((c) => c.id === selectedId);
if (!existing) return;

customerId = existing.id;
custName = existing.name;
custPhone = existing.phone;
custAddress = existing.address;
    }

    const orderItems = [];
    let subtotal = 0;

    manualOrderRows.forEach((row) => {
      const prod = products.find((p) => p.id === Number(row.productId));
      if (prod && row.quantity > 0) {
        const itemTotal = prod.price * row.quantity;
        orderItems.push({
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: Number(row.quantity),
          total: itemTotal
        });
        subtotal += itemTotal;
      }
    });

    if (orderItems.length === 0) {
      SIT_APP?.showToast?.("Please add at least one item.", "error");
      return;
    }

        let createdOrder = null;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            customerId: customerId,
            customerName: custName,
            customerPhone: custPhone,
            customerAddress: custAddress,
            items: orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity
            })),
            notes: "",
            paymentMethod: "Cash on Delivery",
            status: "accepted",
            paymentStatus: "pending",
            source: "manual"
          })
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          `Unable to create order (${response.status})`
        );
      }

      if (!data.order) {
        throw new Error("Server did not return the created order.");
      }

      createdOrder = data.order;

    } catch (err) {
      console.error("Could not save manual order to server:", err);

      SIT_APP?.showToast?.(
        err.message ||
        "Unable to place order. Please try again.",
        "error"
      );

      // Do not create or save a fake local order.
      return;
    }

    orders.push(createdOrder);
    SIT_DATA.saveOrders(orders);

    SIT_APP?.showToast?.(
      `✓ Order #${createdOrder.id} placed!`,
      "success"
    );

    SIT_BILL.open(createdOrder, profile.shopId);

    $("manual-order-form").reset();

    const existingRadio = document.querySelector(
      "input[name='customer-mode'][value='existing']"
    );

    if (existingRadio) {
      existingRadio.checked = true;
    }

    updateCustomerModeUI();
    setupManualOrderForm();
    renderDashboard();
    updateOrdersBadge();
  }

  /* -----------------------------
     MANAGE PRODUCTS
  ----------------------------- */
function renderProducts() {
  const profile = SIT_DATA.getStoreProfile();
  const products = SIT_DATA.getProducts();
  const grid = $("owner-products-grid");

  if (!grid) return;

  grid.innerHTML = "";

  const search = ($("product-search-input")?.value || "")
    .toLowerCase()
    .trim();

const filtered = products.filter((p) => {
  const productName = (p.name || "").toLowerCase();
  const description = (p.description || "").toLowerCase();

  return (
    productName.includes(search) ||
    description.includes(search)
  );
});

  /* -----------------------------
     EMPTY STATE
  ----------------------------- */
  if (filtered.length === 0) {
  grid.innerHTML = `
    <div class="card empty-state products-empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">
          <i data-lucide="package-search"></i>
        </div>

        <div>
          <h3>No products found</h3>
          <p>Try changing your search.</p>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  return;
}

  /* -----------------------------
     PRODUCT CARDS
  ----------------------------- */
  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    /*
      Product image:
      - Use uploaded image when available.
      - Otherwise keep the existing preset emoji for now.
    */
    const iconDisplay = p.imageUrl
  ? `
    <img
      src="${SIT_DATA.escapeHtml(p.imageUrl)}"
      alt="${SIT_DATA.escapeHtml(p.name)}"
      class="product-image"
    >
  `
  : `
    <span class="product-preset-icon lucide-product-icon">
      <i data-lucide="package"></i>
    </span>
  `;

    card.innerHTML = `
      <!-- PRODUCT INFORMATION -->
      <div class="product-card-top">

        <div class="product-icon-box">
          ${iconDisplay}
        </div>

        <div class="product-info-box">

          <span class="product-cat-tag">
            ${SIT_DATA.escapeHtml(p.category || "General")}
          </span>

          <h3 class="product-name">
            ${SIT_DATA.escapeHtml(p.name)}
          </h3>

          ${
            p.description
              ? `
                <p class="product-desc">
                  ${SIT_DATA.escapeHtml(p.description)}
                </p>
              `
              : ""
          }

        </div>

      </div>


      <!-- PRICE + STOCK -->
      <div class="product-card-meta">

        <div class="product-price-display">
          <span class="product-price-label">Price</span>

          <strong>
            ₹${Number(p.price).toFixed(2)}
          </strong>
        </div>

        <button
          type="button"
          class="product-stock-toggle ${
            p.inStock
              ? "product-stock-in"
              : "product-stock-out"
          }"
          aria-label="${
            p.inStock
              ? "Mark product out of stock"
              : "Mark product in stock"
          }"
        >
          <span class="stock-dot"></span>

          <span>
            ${p.inStock ? "In Stock" : "Out of Stock"}
          </span>
        </button>

      </div>


      <!-- ACTIONS -->
      <div class="product-card-actions">

        <button
          type="button"
          class="btn btn-outline btn-xs btn-edit-product"
        >
          <i data-lucide="pencil"></i>
          <span>Edit</span>
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-xs text-danger btn-delete-product"
          aria-label="Delete ${SIT_DATA.escapeHtml(p.name)}"
          title="Delete product"
        >
          <i data-lucide="trash-2"></i>
        </button>

      </div>
    `;


    /* -----------------------------
       STOCK TOGGLE
    ----------------------------- */
card
  .querySelector(".product-stock-toggle")
  .addEventListener("click", async () => {

    const newStockStatus = !p.inStock;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/products/${encodeURIComponent(p.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inStock: newStockStatus
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        SIT_APP?.showToast?.(
          data.error || "Could not update stock.",
          "error"
        );
        return;
      }

      p.inStock = data.product.inStock;

      SIT_DATA.saveProducts(products);

      SIT_APP?.showToast?.(
        `${p.name} is now ${
          p.inStock ? "in stock" : "out of stock"
        }.`,
        "success"
      );

      renderProducts();

    } catch (error) {
      console.error("Failed to update stock:", error);

      SIT_APP?.showToast?.(
        "Unable to update product stock.",
        "error"
      );
    }
  });

    /* -----------------------------
       EDIT PRODUCT
    ----------------------------- */
    card
      .querySelector(".btn-edit-product")
      .addEventListener("click", () => {
        openEditProductModal(p);
      });


    /* -----------------------------
       DELETE PRODUCT
    ----------------------------- */
    card
  .querySelector(".btn-delete-product")
  .addEventListener("click", async () => {

    if (!confirm(`Delete "${p.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/products/${encodeURIComponent(p.id)}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        SIT_APP?.showToast?.(
          data.error || "Could not delete product.",
          "error"
        );
        return;
      }

      const remaining = products.filter(
        (item) => item.id !== p.id
      );

      SIT_DATA.saveProducts(remaining);

      SIT_APP?.showToast?.(
        `Deleted "${p.name}".`,
        "success"
      );

      renderProducts();

    } catch (error) {
      console.error("Failed to delete product:", error);

      SIT_APP?.showToast?.(
        "Unable to delete product.",
        "error"
      );
    }
  });


    grid.appendChild(card);
    if (window.lucide) {
  lucide.createIcons();
}
  });


  /* -----------------------------
     INITIALIZE LUCIDE ICONS
  ----------------------------- */
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

  function openAddProductModal() {
  $("product-modal-title").textContent = "Add New Product";

  $("modal-product-id").value = "";
  $("modal-product-name").value = "";
  $("modal-product-price").value = "";
  $("modal-product-desc").value = "";
  $("modal-product-instock").checked = true;

  $("product-modal").hidden = false;

  // Focus the first field for faster product entry
  setTimeout(() => {
    $("modal-product-name")?.focus();
  }, 50);
}


function openEditProductModal(p) {
  $("product-modal-title").textContent = "Edit Product";

  $("modal-product-id").value = p.id;
  $("modal-product-name").value = p.name;
  $("modal-product-price").value = p.price;
  $("modal-product-desc").value = p.description || "";
  $("modal-product-instock").checked = p.inStock !== false;

  $("product-modal").hidden = false;

  // Focus product name when editing
  setTimeout(() => {
    $("modal-product-name")?.focus();
  }, 50);
}


 async function handleProductModalSubmit(e) {
  e.preventDefault();

  const profile = SIT_DATA.getStoreProfile();

  const products = SIT_DATA.getProducts();
  const editId = $("modal-product-id").value;

  const name = $("modal-product-name").value.trim();
  const price = parseFloat($("modal-product-price").value);
  const description = $("modal-product-desc").value.trim();
  const inStock = $("modal-product-instock").checked;


  // Validate required fields
  if (!name || isNaN(price) || price < 0) {
    SIT_APP?.showToast?.(
      "Please enter a valid product name and price.",
      "error"
    );
    return;
  }


  // EDIT EXISTING PRODUCT
if (editId) {

  const prod = products.find(
    (p) => p.id === Number(editId)
  );

  if (!prod) {
    SIT_APP?.showToast?.(
      "Product could not be found.",
      "error"
    );
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/products/${encodeURIComponent(prod.id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          price,
          description,
          inStock
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      SIT_APP?.showToast?.(
        data.error || "Could not update product.",
        "error"
      );
      return;
    }

    Object.assign(prod, data.product);

    SIT_DATA.saveProducts(products);

    SIT_APP?.showToast?.(
      `✓ Updated ${name}`,
      "success"
    );

  } catch (error) {
    console.error("Failed to update product:", error);

    SIT_APP?.showToast?.(
      "Unable to update product.",
      "error"
    );

    return;
  }

}

  // ADD NEW PRODUCT
  else {

      const response = await fetch(
  `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/products`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      price,
      description,
      inStock,
      category: "Groceries",
    })
  }
);

const data = await response.json();

if (!response.ok) {
  SIT_APP?.showToast?.(
    data.error || "Could not add product.",
    "error"
  );
  return;
}

    products.push({
  ...data.product,
  description: description,
  inStock: inStock,
  category: "Groceries",
  imagePreset: "📦",
  imageUrl: ""
});

    SIT_APP?.showToast?.(
      `✓ Added ${name}`,
      "success"
    );
  }


  // Save changes
  SIT_DATA.saveProducts(products);

  // Close modal
  $("product-modal").hidden = true;

  // Stay on the Products page after saving
switchView("view-products");
 }

  /* -----------------------------
     CUSTOMERS CRM
  ----------------------------- */
  function renderCustomers() {
    const customers = SIT_DATA.getCustomers();
    const orders = SIT_DATA.getOrders();
    const grid = $("owner-customers-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const query = ($("customer-search-input")?.value || "").toLowerCase().trim();
    const filtered = customers.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      c.address.toLowerCase().includes(query)
    );

    filtered.forEach((cust) => {
      const custOrders = orders.filter((o) =>
        (o.customerPhone && o.customerPhone === cust.phone) ||
        (o.customerName && o.customerName.toLowerCase() === cust.name.toLowerCase())
      );

      const card = document.createElement("article");
      card.className = "customer-card";

      const initials = cust.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      card.innerHTML = `
        <div class="customer-card-header">
          <div class="cust-avatar">${initials}</div>
          <div>
            <h3 style="font-size: 0.95rem; font-weight: 700;">${SIT_DATA.escapeHtml(cust.name)}</h3>
            <p class="customer-contact">
  <i data-lucide="phone"></i>
  <span>${SIT_DATA.escapeHtml(cust.phone)}</span>
</p>

<p class="customer-contact customer-address">
  <i data-lucide="map-pin"></i>
  <span>${SIT_DATA.escapeHtml(cust.address)}</span>
</p></div>
        </div>

        <div class="customer-card-stats">
          <div class="customer-stat-item">
            <small>Total Orders</small>
            <strong>${custOrders.length} orders</strong>
          </div>
          <div class="customer-stat-item">
            <small>Total Spent</small>
            <strong class="text-emerald">
  ${SIT_DATA.formatCurrency(
    custOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0)
  )}
</strong>
          </div>
        </div>

        <div class="customer-card-actions">
          <button type="button" class="btn btn-outline btn-xs btn-cust-order-now">
            <i data-lucide="plus"></i>
                     <span>Create Order</span>
          </button>
          <button type="button" class="btn btn-ghost btn-xs btn-toggle-history">
            <i data-lucide="history"></i>
            <span>History (${custOrders.length})</span>
          </button>
        </div>

        <div class="customer-history-box" id="cust-history-${cust.id}" hidden style="margin-top: 0.5rem; background: var(--bg-subtle); padding: 0.5rem; border-radius: var(--radius-xs); font-size: 0.75rem;">
          <strong>Order History:</strong>
          <ul style="padding-left: 1rem; margin-top: 0.25rem;">
            ${custOrders.length === 0 ? `<li>No orders yet</li>` : custOrders.map((o) => `
  <li>
    #${o.id} — ${SIT_DATA.formatCurrency(o.total)}
    (${o.status}) —
    ${o.paymentStatus === "paid" ? "PAID" : "PENDING"}
  </li>
`).join("")}
          </ul>
        </div>
      `;

      card.querySelector(".btn-cust-order-now").addEventListener("click", () => {
        const existingRadio = document.querySelector("input[name='customer-mode'][value='existing']");
        if (existingRadio) existingRadio.checked = true;
        updateCustomerModeUI();
        switchView("view-new-order");
        $("select-customer").value = cust.id;
        $("select-customer").dispatchEvent(new Event("change"));
      });

      card.querySelector(".btn-toggle-history").addEventListener("click", () => {
        const h = $(`cust-history-${cust.id}`);
        h.hidden = !h.hidden;
      });

      grid.appendChild(card);
    });

    if (window.lucide) {
  lucide.createIcons();
}
  }

  async function handleCustomerModalSubmit(e) {
    e.preventDefault();
    const customers = SIT_DATA.getCustomers();
    const name = $("modal-cust-name").value.trim();
    const phone = $("modal-cust-phone").value.trim();
    const address = $("modal-cust-address").value.trim();

    if (!name || !phone || !address) {
      SIT_APP?.showToast?.("Please fill in customer details.", "error");
      return;
    }

    const profile = SIT_DATA.getStoreProfile();
    try {
      const response = await fetch(`${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/customers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, address }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save customer.");
      customers.push(data.customer);
      SIT_DATA.saveCustomers(customers);
    } catch (error) {
      SIT_APP?.showToast?.(error.message || "Unable to connect to SUMUKH server.", "error");
      return;
    }

    SIT_APP?.showToast?.(`✓ Customer "${name}" saved.`, "success");
    $("customer-modal").hidden = true;
    $("customer-modal-form").reset();
    renderCustomers();
  }

  /* -----------------------------
     SALES RECORDS
  ----------------------------- */
  function renderSales() {
    const orders = SIT_DATA.getOrders();
    const tbody = $("sales-records-tbody");
    const mobileContainer = $("sales-mobile-cards");
    if (!tbody && !mobileContainer) return;
    if (tbody) tbody.innerHTML = "";
    if (mobileContainer) mobileContainer.innerHTML = "";

    const completed = orders.filter(
  (o) => o.paymentStatus === "paid" && o.status !== "cancelled"
);
    const now = new Date();

    const filtered = completed.filter((o) => {
      const orderDate = new Date(o.completedAt || o.createdAt);
      if (activeSalesFilter === "today") return orderDate.toDateString() === now.toDateString();
      if (activeSalesFilter === "week") return orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (activeSalesFilter === "month") return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      return true;
    });

    const totalRevenue = filtered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    if ($("sales-stat-count")) $("sales-stat-count").textContent = filtered.length;
    if ($("sales-stat-revenue")) $("sales-stat-revenue").textContent = SIT_DATA.formatCurrency(totalRevenue);

    if (filtered.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 1.5rem;">No completed sales for this period.</td></tr>`;
      if (mobileContainer) mobileContainer.innerHTML = `<div class="card text-center text-muted" style="padding: 1.5rem;">No completed sales for this period.</div>`;
      return;
    }

    filtered.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

    filtered.forEach((order) => {
      const itemsStr = (order.items || []).map((i) => `${i.name} × ${i.quantity}`).join(", ");

      if (tbody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="font-bold">#${order.id}</td>
          <td>${SIT_DATA.formatDate(order.completedAt || order.createdAt)}</td>
          <td class="font-bold">${SIT_DATA.escapeHtml(order.customerName)}</td>
          <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${SIT_DATA.escapeHtml(itemsStr)}
          </td>
          <td class="font-bold text-emerald">
            ${SIT_DATA.formatCurrency(order.total)}
          </td>
        `;
        tbody.appendChild(tr);
      }

      if (mobileContainer) {
        const card = document.createElement("article");
        card.className = "mobile-record-card";
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span class="font-bold" style="font-size: 1rem;">#${order.id}</span>
            <span class="text-muted" style="font-size: 0.8rem;">${SIT_DATA.formatDate(order.completedAt || order.createdAt)}</span>
          </div>
          <div style="font-weight: 700; color: var(--text-main); margin-top: 0.25rem;">
            ${SIT_DATA.escapeHtml(order.customerName)}
          </div>
          <div style="font-size: 0.82rem; color: var(--text-body); background: var(--bg-subtle); padding: 0.4rem 0.6rem; border-radius: var(--radius-xs); margin-top: 0.25rem; word-break: break-word;">
            ${SIT_DATA.escapeHtml(itemsStr || "No items")}
          </div>
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
            <strong class="text-emerald" style="font-size: 1.05rem;">${SIT_DATA.formatCurrency(order.total)}</strong>
          </div>
        `;
        mobileContainer.appendChild(card);
      }
    });
  }

  /* -----------------------------
     BILLS & INVOICES DIRECTORY
  ----------------------------- */
  function renderBills() {
    const orders = SIT_DATA.getOrders();
    const tbody = $("bills-records-tbody");
    const mobileContainer = $("bills-mobile-cards");
    if (!tbody && !mobileContainer) return;
    if (tbody) tbody.innerHTML = "";
    if (mobileContainer) mobileContainer.innerHTML = "";

    // --- Pending Payments Summary ---
    const pendingOrders = orders.filter((o) => o.paymentStatus !== "paid");
    const pendingTotal = pendingOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const pendingCount = pendingOrders.length;
    const summaryEl = $("bills-pending-summary");
    if (summaryEl) {
      if (pendingCount > 0) {
        summaryEl.style.display = "flex";
        if ($("bills-pending-amount")) $("bills-pending-amount").textContent = SIT_DATA.formatCurrency(pendingTotal);
        if ($("bills-pending-count")) $("bills-pending-count").textContent = pendingCount + " pending bill" + (pendingCount !== 1 ? "s" : "");
      } else {
        summaryEl.style.display = "none";
      }
    }

    const query = ($("bills-search-input")?.value || "").toLowerCase().trim();
    const statusFilter = $("bills-status-filter")?.value || "all";

    const filtered = orders.filter((o) => {
      const matchSearch =
        String(o.id).includes(query) ||
        o.customerName.toLowerCase().includes(query) ||
        (o.customerPhone && o.customerPhone.includes(query));

      let matchStatus = true;
      if (statusFilter === "paid") matchStatus = o.paymentStatus === "paid";
      else if (statusFilter === "pending") matchStatus = o.paymentStatus !== "paid";

      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 1.5rem;">No bills found matching criteria.</td></tr>`;
      if (mobileContainer) mobileContainer.innerHTML = `<div class="card text-center text-muted" style="padding: 1.5rem;">No bills found matching criteria.</div>`;
      return;
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    filtered.forEach((order) => {
      const itemsSummary = (order.items || []).map((i) => `${i.name} × ${i.quantity}`).join(", ");
      const isPaid = order.paymentStatus === "paid";

      // Desktop table row
      if (tbody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="font-bold">#${order.id}</td>
          <td>${SIT_DATA.formatDate(order.createdAt)} <small class="text-muted">${SIT_DATA.formatTime(order.createdAt)}</small></td>
          <td>
            <strong>${SIT_DATA.escapeHtml(order.customerName)}</strong>
            <small class="text-muted" style="display: block;">${SIT_DATA.escapeHtml(order.customerPhone || "N/A")}</small>
          </td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${SIT_DATA.escapeHtml(itemsSummary)}
          </td>
          <td class="font-bold text-emerald">${SIT_DATA.formatCurrency(order.total)}</td>
          <td>
            <span class="pay-status-pill pay-status-${order.paymentStatus}">
              ${isPaid ? "PAID" : "PENDING"}
            </span>
          </td>
          <td>
            <button class="btn btn-outline btn-xs btn-open-bill-row" data-order-id="${order.id}">
              🧾 View Bill
            </button>
          </td>
        `;

        tr.querySelector(".btn-open-bill-row")?.addEventListener("click", () => SIT_BILL.open(order.id));
        tbody.appendChild(tr);
      }

      // Mobile card
      if (mobileContainer) {
        const card = document.createElement("article");
        card.className = "mobile-record-card";
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="font-bold" style="font-size: 1rem;">#${order.id}</span>
            <span class="pay-status-pill pay-status-${order.paymentStatus}">
              ${isPaid ? "PAID" : "PENDING"}
            </span>
          </div>
          <div class="text-muted" style="font-size: 0.78rem;">
            ${SIT_DATA.formatDate(order.createdAt)} • ${SIT_DATA.formatTime(order.createdAt)}
          </div>
          <div style="margin-top: 0.25rem;">
            <strong style="color: var(--text-main);">${SIT_DATA.escapeHtml(order.customerName)}</strong>
            <small class="text-muted" style="display: block; font-size: 0.8rem;">${SIT_DATA.escapeHtml(order.customerPhone || "N/A")}</small>
          </div>
          <div style="font-size: 0.82rem; color: var(--text-body); background: var(--bg-subtle); padding: 0.4rem 0.6rem; border-radius: var(--radius-xs); margin-top: 0.25rem; word-break: break-word;">
            ${SIT_DATA.escapeHtml(itemsSummary || "No items")}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
            <strong class="text-emerald" style="font-size: 1.05rem;">${SIT_DATA.formatCurrency(order.total)}</strong>
            <button class="btn btn-outline btn-xs btn-open-bill-mobile" data-order-id="${order.id}">
              🧾 View Bill
            </button>
          </div>
        `;

        card.querySelector(".btn-open-bill-mobile")?.addEventListener("click", () => SIT_BILL.open(order.id));
        mobileContainer.appendChild(card);
      }
    });
  }

  /* -----------------------------
     MY SHOP & STOREFRONT QR
  ----------------------------- */
function renderMyShop() {
  const profile = SIT_DATA.getStoreProfile();

  if (!profile || !profile.shopId) {
    SIT_APP?.showToast?.(
      "Shop information is not available.",
      "error"
    );
    return;
  }

  /*
    Build the shop-specific customer URL.

    Example:
    shop.html?shop=dryyy
  */
const baseUrl =
  window.location.origin +
  window.location.pathname.replace(/[^/]*$/, "");

const storefrontUrl =
  `${baseUrl}landing.html?shop=${encodeURIComponent(profile.shopId)}`;

  // Profile summary
  if ($("myshop-profile-name")) {
    $("myshop-profile-name").textContent =
      profile.shopName || "My Shop";
  }

  if ($("myshop-profile-meta")) {
    $("myshop-profile-meta").textContent =
      `${profile.address || ""} • Ph: ${profile.phone || ""}`;
  }

  if ($("myshop-upi-code")) {
    $("myshop-upi-code").textContent =
      profile.upiId || "Not added";
  }

  // Shop-specific customer URL
  if ($("share-shop-url-input")) {
    $("share-shop-url-input").value = storefrontUrl;
  }

  if ($("btn-myshop-preview-top")) {
    $("btn-myshop-preview-top").href = storefrontUrl;
  }

  if ($("btn-open-customer-storefront")) {
    $("btn-open-customer-storefront").href = storefrontUrl;
  }

  if ($("sidebar-open-shop-link")) {
    $("sidebar-open-shop-link").href = storefrontUrl;
  }

  if ($("mobile-open-shop-link")) {
    $("mobile-open-shop-link").href = storefrontUrl;
  }

  // QR Standee
  if ($("standee-shop-name")) {
    $("standee-shop-name").textContent =
      profile.shopName || "My Shop";
  }

  if ($("standee-shop-meta")) {
    $("standee-shop-meta").textContent =
      "Scan to browse catalog & order";
  }

  // Generate QR from THIS shop's URL
  if ($("share-qr-container")) {
    SIT_BILL.renderQrCode(
      $("share-qr-container"),
      storefrontUrl
    );
  }
}
  function renderSettings() {
    const profile = SIT_DATA.getStoreProfile();
    if ($("settings-shop-name")) $("settings-shop-name").value = profile.shopName || "";
    if ($("settings-owner-name")) $("settings-owner-name").value = profile.ownerName || "";
    if ($("settings-phone")) $("settings-phone").value = profile.phone || "";
    if ($("settings-address")) $("settings-address").value = profile.address || "";
    if ($("settings-upi-id")) $("settings-upi-id").value = profile.upiId || "";
  }

  async function renderAll() {
    await syncOwnerData();

    renderDashboard();
    renderOrders();
    renderProducts();
    renderCustomers();
    renderSales();
    renderBills();
    renderMyShop();
    renderSettings();

    switchView(currentOwnerView);
  }

  function bindEvents() {
    // Auth
    $("tab-login")?.addEventListener("click", () => {
      $("tab-login").classList.add("active");
      $("tab-signup").classList.remove("active");
      $("owner-login-form").hidden = false;
      $("owner-signup-form").hidden = true;
    });

    $("tab-signup")?.addEventListener("click", () => {
      $("tab-signup").classList.add("active");
      $("tab-login").classList.remove("active");
      $("owner-signup-form").hidden = false;
      $("owner-login-form").hidden = true;
    });

    // Password visibility toggle
$("btn-toggle-login-password")?.addEventListener("click", () => {
  const passwordInput = $("login-password");
  const toggleBtn = $("btn-toggle-login-password");

  if (!passwordInput || !toggleBtn) return;

  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";

  toggleBtn.setAttribute(
    "aria-label",
    isHidden ? "Hide password" : "Show password"
  );

  toggleBtn.innerHTML = `
    <i data-lucide="${isHidden ? "eye-off" : "eye"}"></i>
  `;

  if (window.lucide) {
    lucide.createIcons();
  }
});

  $("owner-login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const identifier = $("login-email").value.trim();
  const password = $("login-password").value;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to log in.");
    SIT_DATA.setActiveShopId(data.shop.shopId);
    SIT_DATA.saveStoreProfile(data.shop);
    SIT_DATA.saveOwnerAuth({ isLoggedIn: true, email: data.shop.email, shopId: data.shop.shopId });
    SIT_APP?.showToast?.("✓ Logged into Dashboard", "success");
    checkAuth();
  } catch (error) { SIT_APP?.showToast?.(error.message || "Unable to connect to SUMUKH server.", "error"); }
});


$("owner-signup-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ownerName = $("signup-owner-name").value.trim();
  const shopName = $("signup-business-name").value.trim();
  const phone = $("signup-phone").value.trim();
  const email = $("signup-email").value.trim();
  const password = $("signup-password").value;
  const address = $("signup-address").value.trim();

  if (
    !ownerName ||
    !shopName ||
    !phone ||
    !email ||
    !password ||
    !address
  ) {
    SIT_APP?.showToast?.(
      "Please fill in all required fields.",
      "error"
    );
    return;
  }

  const shopId = shopName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "my-shop";

  try {
    const response = await fetch(
  `${SUMUKH_CONFIG.API_BASE_URL}/api/shops`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          shopId, ownerName, shopName, phone, email, password, address, upiId: ""
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Backend shop creation failed:", data);

      SIT_APP?.showToast?.(
        data.error || "Could not create shop on SUMUKH server.",
        "error"
      );

      return;
    }

    // Backend and frontend now use the same shop ID.
SIT_DATA.setActiveShopId(data.shop.shopId);
SIT_DATA.saveStoreProfile(data.shop);

SIT_DATA.saveOwnerAuth({
  isLoggedIn: true,
  email: data.shop.email,
  shopId: data.shop.shopId
});

    SIT_APP?.showToast?.(
      `✓ ${data.shop.shopName} account created`,
      "success"
    );

    checkAuth();

  } catch (error) {
    console.error(
      "Failed to connect to SUMUKH backend:",
      error
    );

    SIT_APP?.showToast?.(
      "Unable to connect to the SUMUKH server. Your account was not created.",
      "error"
    );
  }
});

    $("btn-owner-logout")?.addEventListener("click", () => {
      SIT_DATA.saveOwnerAuth({ isLoggedIn: false, email: "" });
      checkAuth();
    });
    $("btn-mobile-logout")?.addEventListener("click", () => {
      SIT_DATA.saveOwnerAuth({ isLoggedIn: false, email: "" });
      checkAuth();
    });

    // Navigation
document.querySelectorAll("[data-owner-view]").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    event.preventDefault();

    const targetView = btn.dataset.ownerView;

    if (targetView) {
      switchView(targetView);
    }
  });
});

    // Orders Filter
    document.querySelectorAll("[data-order-filter]").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("[data-order-filter]").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeOrderFilter = tab.dataset.orderFilter;
        renderOrders();
      });
    });

    // Manual Order Form
    document.querySelectorAll("input[name='customer-mode']").forEach((radio) => {
      radio.addEventListener("change", () => {
        updateCustomerModeUI();
      });
    });

    $("select-customer")?.addEventListener("change", (e) => {
      const custId = Number(e.target.value);
      const summaryBox = $("selected-customer-summary");
      if (!custId) {
        summaryBox.hidden = true;
        return;
      }
      const cust = SIT_DATA.getCustomers().find((c) => c.id === custId);
      if (cust) {
        summaryBox.hidden = false;
        $("summary-cust-name").textContent = cust.name;
        $("summary-cust-phone").textContent = `Phone: ${cust.phone}`;
        $("summary-cust-addr").textContent = `Address: ${cust.address}`;
      }
    });

    $("btn-add-item-row")?.addEventListener("click", () => {
  manualOrderRows.push({
    id: Date.now(),
    productId: null,
    quantity: 1
  });

  renderManualOrderItemsTable();
  updateManualOrderSummary();
});

    $("manual-order-form")?.addEventListener("submit", handleManualOrderSubmit);

    // Mobile More Menu
    $("btn-owner-more")?.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = $("owner-more-modal");
      if (modal) {
        modal.hidden = !modal.hidden;
        if (!modal.hidden && window.lucide) {
          lucide.createIcons();
        }
      }
    });

    $("btn-close-owner-more")?.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = $("owner-more-modal");
      if (modal) modal.hidden = true;
    });

    $("owner-more-modal")?.addEventListener("click", (e) => {
      if (e.target === $("owner-more-modal") || e.target.classList.contains("modal-backdrop")) {
        $("owner-more-modal").hidden = true;
      }
    });

    document.querySelectorAll(".more-menu-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const modal = $("owner-more-modal");
        if (modal) modal.hidden = true;
        const targetView = btn.dataset.ownerView;
        if (targetView) {
          switchView(targetView);
        }
      });
    });

    // Products
    $("btn-open-add-product")?.addEventListener("click", openAddProductModal);
    $("btn-close-product-modal")?.addEventListener("click", () => $("product-modal").hidden = true);
    $("btn-cancel-product-modal")?.addEventListener("click", () => $("product-modal").hidden = true);
    $("product-modal-form")?.addEventListener("submit", handleProductModalSubmit);
    $("product-search-input")?.addEventListener("input", renderProducts);

    // Customers
    $("btn-open-add-customer")?.addEventListener("click", () => $("customer-modal").hidden = false);
    $("btn-close-customer-modal")?.addEventListener("click", () => $("customer-modal").hidden = true);
    $("btn-cancel-customer-modal")?.addEventListener("click", () => $("customer-modal").hidden = true);
    $("customer-modal-form")?.addEventListener("submit", handleCustomerModalSubmit);
    $("customer-search-input")?.addEventListener("input", renderCustomers);

    // Sales filter
    document.querySelectorAll("[data-sales-filter]").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("[data-sales-filter]").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeSalesFilter = tab.dataset.salesFilter;
        renderSales();
      });
    });

    // Share & Settings
    $("btn-copy-shop-link")?.addEventListener("click", () => {
      const inp = $("share-shop-url-input");
      inp.select();
      navigator.clipboard.writeText(inp.value).then(() => {
        SIT_APP?.showToast?.("✓ Store link copied!", "success");
      });
    });

    $("btn-whatsapp-share")?.addEventListener("click", () => {
      const profile = SIT_DATA.getStoreProfile();
      const url = $("share-shop-url-input").value;
      const text = `Order fresh products directly from *${profile.shopName}*: ${url}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    });

    // Bills & Invoices Listeners
    $("bills-search-input")?.addEventListener("input", renderBills);
    $("bills-status-filter")?.addEventListener("change", renderBills);
    $("store-settings-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const profile = {
        shopName: $("settings-shop-name").value.trim(),
        ownerName: $("settings-owner-name").value.trim(),
        phone: $("settings-phone").value.trim(),
        address: $("settings-address").value.trim(),
        upiId: $("settings-upi-id").value.trim(),
        currency: "₹"
      };
      const current = SIT_DATA.getStoreProfile();
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/${encodeURIComponent(current.shopId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not save settings.");
        SIT_DATA.saveStoreProfile(data.shop);
        SIT_APP?.showToast?.("✓ Settings saved.", "success");
        renderDashboard();
      } catch (error) { SIT_APP?.showToast?.(error.message || "Unable to connect to SUMUKH server.", "error"); }
    });

    window.addEventListener("sit:order-updated", () => {
      updateOrdersBadge();
      if (currentOwnerView === "view-orders") {
        renderOrders();
      } else if (currentOwnerView === "view-dashboard") {
        renderDashboard();
      } else if (currentOwnerView === "view-bills") {
        renderBills();
      } else if (currentOwnerView === "view-sales") {
        renderSales();
      }
    });

    window.addEventListener("sit:bill-closed", () => {
      updateOrdersBadge();
      if (currentOwnerView === "view-orders") {
        renderOrders();
      } else if (currentOwnerView === "view-dashboard") {
        renderDashboard();
      } else if (currentOwnerView === "view-bills") {
        renderBills();
      } else if (currentOwnerView === "view-sales") {
        renderSales();
      }
    });

    window.addEventListener("sit:data-sync", (event) => {
      // Re-render everything only when another browser tab/window
      // changes SIT data.
      if (event.detail?.key === "storage-event") {
        renderAll();
      }
    });
  }

  function init() {
    bindEvents();
    checkAuth();
  }

  return {
    init,
    renderAll,
    switchView
  };
})();
