/* ========================================================================
   SIT — CUSTOMER STOREFRONT LOGIC
   Backend-first customer ordering flow
   ======================================================================== */

const SIT_CUSTOMER = (function () {
  "use strict";

  const API_BASE_URL = SUMUKH_CONFIG.API_BASE_URL;
  const $ = (id) => document.getElementById(id);

  let currentCatalogProducts = [];
  let currentShopProfile = null;
  let currentCreatedOrder = null;
  let currentCategory = "all";
  let eventsBound = false;
  let trackingPollTimer = null;

  function stopTrackingPoll() {
    if (trackingPollTimer) {
      clearInterval(trackingPollTimer);
      trackingPollTimer = null;
    }
  }

  function startTrackingPoll() {
    stopTrackingPoll();
    trackingPollTimer = setInterval(async () => {
      const trackView = $("cust-view-track");
      if (!trackView || trackView.hidden) {
        stopTrackingPoll();
        return;
      }
      await renderTracking();
    }, 10000);
  }

  /* =========================================================
     SHOP / URL
     ========================================================= */

  function getShopIdFromUrl() {
    const params = new URLSearchParams(window.location.search);

    let shopId = params.get("shop");

    if (!shopId && window.location.hash.startsWith("#shop/")) {
      shopId = window.location.hash
        .replace("#shop/", "")
        .trim();
    }

    return shopId
      ? String(shopId).trim()
      : null;
  }

  function hasShopSelected() {
    return !!getShopIdFromUrl();
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function escape(value) {
    return SIT_DATA.escapeHtml(
      String(value ?? "")
    );
  }

  function normalizeProducts(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.products)) {
      return payload.products;
    }

    return [];
  }

  function normalizeOrders(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.orders)) {
      return payload.orders;
    }

    return [];
  }

  /* =========================================================
     VIEW NAVIGATION
     ========================================================= */

  function setView(viewId) {
    document
      .querySelectorAll(".cust-view")
      .forEach((view) => {
        const isActive = view.id === viewId;

        view.hidden = !isActive;
        view.classList.toggle(
          "active",
          isActive
        );
      });

    document
      .querySelectorAll(".cust-nav-tab")
      .forEach((tab) => {
        tab.classList.toggle(
          "active",
          tab.dataset.custView === viewId
        );
      });
  }

  function switchView(viewId) {
    setView(viewId);

    if (viewId === "cust-view-shop") {
      stopTrackingPoll();
      renderCatalog();
    } else if (viewId === "cust-view-track") {
      renderTracking();
      startTrackingPoll();
    } else {
      stopTrackingPoll();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* =========================================================
     CUSTOMER DASHBOARD
     ========================================================= */

  function showDashboard() {
    stopTrackingPoll();
    const dashboard =
      $("cust-dashboard-view");

    const main =
      $("cust-main-content");

    const header =
      document.querySelector(".cust-header");

    const footer =
      document.querySelector(".cust-footer");

    if (dashboard) {
      dashboard.hidden = false;
    }

    if (main) {
      main.hidden = true;
    }

    if (header) {
      header.hidden = true;
    }

    if (footer) {
      footer.hidden = false;
    }

    renderCustomerDashboard();
  }

  function showStore() {
    const dashboard =
      $("cust-dashboard-view");

    const main =
      $("cust-main-content");

    const header =
      document.querySelector(".cust-header");

    if (dashboard) {
      dashboard.hidden = true;
    }

    if (main) {
      main.hidden = false;
    }

    if (header) {
      header.hidden = false;
    }

    renderHeader();
    renderCatalog();
  }

  async function fetchAllShops() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shops`
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load shops."
        );
      }

      const payload =
        await response.json();

      if (Array.isArray(payload)) {
        return payload;
      }

      if (Array.isArray(payload?.shops)) {
        return payload.shops;
      }

      return [];

    } catch (error) {
      console.warn(
        "Unable to load shops from SUMUKH server:",
        error
      );

      return [];
    }
  }

  async function renderCustomerDashboard() {
    const list =
      $("cust-store-list");

    if (!list) {
      return;
    }

    const shops =
      await fetchAllShops();

    if (shops.length === 0) {
      const fallback =
        SIT_DATA.getStoreProfile();

      if (fallback?.shopId) {
        list.innerHTML = `
          <article class="cust-store-card">
            <div class="cust-store-info">

              <h3 class="cust-store-name">
                ${escape(
                  fallback.shopName ||
                  "Local Shop"
                )}
              </h3>

              <p class="cust-store-address">
                ${escape(
                  fallback.address || ""
                )}
              </p>

            </div>

            <div class="cust-store-action">
              <a
                href="shop.html?shop=${encodeURIComponent(
                  fallback.shopId
                )}"
                class="btn btn-primary btn-sm"
              >
                View Store
              </a>
            </div>
          </article>
        `;
      } else {
        list.innerHTML = `
          <div class="card cust-empty-products">
            <h3>No stores available</h3>
            <p>
              There are no registered shops yet.
            </p>
          </div>
        `;
      }

      return;
    }

    list.innerHTML = shops
      .map((shop) => {
        return `
          <article class="cust-store-card">

            <div class="cust-store-info">

              <h3 class="cust-store-name">
                ${escape(
                  shop.shopName ||
                  "Local Shop"
                )}
              </h3>

              <p class="cust-store-address">
                ${escape(
                  shop.address || ""
                )}
              </p>

            </div>

            <div class="cust-store-action">

              <a
                href="shop.html?shop=${encodeURIComponent(
                  shop.shopId
                )}"
                class="btn btn-primary btn-sm"
              >
                View Store
              </a>

            </div>

          </article>
        `;
      })
      .join("");
  }

  /* =========================================================
     SHOP PROFILE
     ========================================================= */

  async function fetchShopProfile(shopId) {
    if (!shopId) {
      currentShopProfile =
        SIT_DATA.getStoreProfile();

      return currentShopProfile;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shops/${encodeURIComponent(
          shopId
        )}`
      );

      if (!response.ok) {
        return null;
      }

      const payload =
        await response.json();

      if (payload?.shop) {
        currentShopProfile =
          payload.shop;

        /*
         * Keep a local copy only so the
         * existing UI can still resolve the shop.
         * Backend remains the source of truth.
         */

        SIT_DATA.setActiveShopId?.(
          payload.shop.shopId
        );

        SIT_DATA.saveStoreProfile?.(
          payload.shop
        );

        return currentShopProfile;
      }

    } catch (error) {
      console.warn(
        "Unable to load shop profile from SUMUKH server:",
        error
      );
    }

    currentShopProfile =
      SIT_DATA.getShopById(shopId);

    return currentShopProfile;
  }

  function resolveShop() {
    if (currentShopProfile) {
      return currentShopProfile;
    }

    const shopId =
      getShopIdFromUrl();

    if (shopId) {
      return SIT_DATA.getShopById(
        shopId
      );
    }

    return SIT_DATA.getStoreProfile();
  }

  function renderHeader() {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    if ($("cust-shop-name")) {
      $("cust-shop-name").textContent =
        profile.shopName ||
        "Local Shop";
    }

    if ($("cust-shop-address")) {
      $("cust-shop-address").textContent =
        profile.address || "";
    }
  }

  /* =========================================================
     PRODUCTS FROM BACKEND
     ========================================================= */

  async function fetchShopProducts(shopId) {
    const response = await fetch(
      `${API_BASE_URL}/api/shops/${encodeURIComponent(
        shopId
      )}/products`
    );

    if (!response.ok) {
      throw new Error(
        "Unable to load shop products."
      );
    }

    const payload =
      await response.json();

    return normalizeProducts(
      payload
    );
  }

  function getVisibleProducts(products) {
    if (
      currentCategory === "all"
    ) {
      return products;
    }

    return products.filter(
      (product) => {
        const category =
          String(
            product.category || ""
          )
            .toLowerCase()
            .trim();

        return (
          category ===
          String(currentCategory)
            .toLowerCase()
            .trim()
        );
      }
    );
  }

  function productImage(product) {
    if (product.imageUrl) {
      return `
        <div class="cust-product-image">

          <img
            src="${escape(
              product.imageUrl
            )}"
            alt="${escape(
              product.name
            )}"
          >

        </div>
      `;
    }

    return `
      <div
        class="
          cust-product-image
          cust-product-icon-fallback
        "
      >
        <i data-lucide="package"></i>
      </div>
    `;
  }

  function renderProductAction(
    product,
    cartQty
  ) {
    if (!product.inStock) {
      return `
        <span class="stock-badge-out">
          Unavailable
        </span>
      `;
    }

    if (cartQty > 0) {
      return `
        <div class="qty-stepper">

          <button
            type="button"
            class="stepper-btn btn-cart-dec"
            data-prod-id="${escape(
              product.id
            )}"
          >
            −
          </button>

          <span class="stepper-val">
            ${cartQty}
          </span>

          <button
            type="button"
            class="stepper-btn btn-cart-inc"
            data-prod-id="${escape(
              product.id
            )}"
          >
            +
          </button>

        </div>
      `;
    }

    return `
      <button
        type="button"
        class="
          btn
          btn-primary
          btn-xs
          btn-cust-add-cart
        "
        data-prod-id="${escape(
          product.id
        )}"
      >
        Add
      </button>
    `;
  }

  async function renderCatalog() {
    const profile =
      resolveShop();

    const grid =
      $("cust-products-grid");

    if (!profile || !grid) {
      return;
    }

    renderHeader();

    try {
      const products =
        await fetchShopProducts(
          profile.shopId
        );

      currentCatalogProducts =
        products;

      const visibleProducts =
        getVisibleProducts(
          products
        );

      const cart =
        SIT_DATA.getCartByShopId(
          profile.shopId
        );

      grid.innerHTML = "";

      if (
        visibleProducts.length === 0
      ) {
        grid.innerHTML = `
          <div class="card cust-empty-products">

            <h3>
              ${
                products.length === 0
                  ? "No products available"
                  : "No products in this category"
              }
            </h3>

            <p>
              ${
                products.length === 0
                  ? "This store has not added any products yet."
                  : "Try another category."
              }
            </p>

          </div>
        `;

        updateOrderConfirmBox();
        return;
      }

      visibleProducts.forEach(
        (product) => {
          const cartItem =
            cart.find(
              (item) =>
                String(
                  item.productId
                ) ===
                String(product.id)
            );

          const cartQty =
            cartItem?.quantity || 0;

          const card =
            document.createElement(
              "article"
            );

          card.className =
            "cust-product-card";

          card.innerHTML = `
            <div class="cust-product-top">

              ${productImage(product)}

              <div class="cust-product-details">

                <h3 class="cust-product-title">
                  ${escape(
                    product.name
                  )}
                </h3>

                ${
                  product.description
                    ? `
                      <p class="cust-product-desc">
                        ${escape(
                          product.description
                        )}
                      </p>
                    `
                    : ""
                }

              </div>

            </div>

            <div class="cust-product-footer">

              <span class="cust-product-price">
                ${SIT_DATA.formatCurrency(
                  product.price
                )}
              </span>

              <div>
                ${renderProductAction(
                  product,
                  cartQty
                )}
              </div>

            </div>
          `;

          card
            .querySelector(
              ".btn-cust-add-cart"
            )
            ?.addEventListener(
              "click",
              () => {
                addToCart(
                  product.id
                );
              }
            );

          card
            .querySelector(
              ".btn-cart-inc"
            )
            ?.addEventListener(
              "click",
              () => {
                incrementCart(
                  product.id
                );
              }
            );

          card
            .querySelector(
              ".btn-cart-dec"
            )
            ?.addEventListener(
              "click",
              () => {
                decrementCart(
                  product.id
                );
              }
            );

          grid.appendChild(card);
        }
      );

      if (window.lucide) {
        lucide.createIcons();
      }

      updateOrderConfirmBox();

    } catch (error) {
      console.error(
        "Failed to load products:",
        error
      );

      currentCatalogProducts = [];

      grid.innerHTML = `
        <div class="card cust-empty-products">

          <h3>
            Unable to load products
          </h3>

          <p>
            Please try again in a moment.
          </p>

        </div>
      `;
    }
  }

    /* =========================================================
     CART
     ========================================================= */

  function addToCart(productId) {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    const product =
      currentCatalogProducts.find(
        (item) =>
          String(item.id) ===
          String(productId)
      );

    if (!product) {
      return;
    }

    if (!product.inStock) {
      SIT_APP?.showToast?.(
        "This product is unavailable.",
        "error"
      );
      return;
    }

    const cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    const existing =
      cart.find(
        (item) =>
          String(item.productId) ===
          String(productId)
      );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        quantity: 1,
        imagePreset:
          product.imagePreset || "",
        imageUrl:
          product.imageUrl || ""
      });
    }

    SIT_DATA.saveCartByShopId(
      profile.shopId,
      cart
    );

    SIT_APP?.showToast?.(
      `Added ${product.name} to cart.`,
      "default"
    );

    renderCatalog();
    updateOrderConfirmBox();
  }

  function incrementCart(productId) {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    const cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    const existing =
      cart.find(
        (item) =>
          String(item.productId) ===
          String(productId)
      );

    if (!existing) {
      return;
    }

    existing.quantity += 1;

    SIT_DATA.saveCartByShopId(
      profile.shopId,
      cart
    );

    renderCatalog();
    renderCart();
    updateOrderConfirmBox();
  }

  function decrementCart(productId) {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    let cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    const existing =
      cart.find(
        (item) =>
          String(item.productId) ===
          String(productId)
      );

    if (!existing) {
      return;
    }

    existing.quantity -= 1;

    if (existing.quantity <= 0) {
      cart =
        cart.filter(
          (item) =>
            String(item.productId) !==
            String(productId)
        );
    }

    SIT_DATA.saveCartByShopId(
      profile.shopId,
      cart
    );

    renderCatalog();
    renderCart();
    updateOrderConfirmBox();
  }

  function removeCart(productId) {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    let cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    cart =
      cart.filter(
        (item) =>
          String(item.productId) !==
          String(productId)
      );

    SIT_DATA.saveCartByShopId(
      profile.shopId,
      cart
    );

    renderCatalog();
    renderCart();
    updateOrderConfirmBox();
  }

  function clearCart() {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    SIT_DATA.saveCartByShopId(
      profile.shopId,
      []
    );

    renderCatalog();
    renderCart();
    updateOrderConfirmBox();
  }

  /* =========================================================
     ORDER CONFIRM BOX
     ========================================================= */

  function updateOrderConfirmBox() {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    const cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    const confirmBox =
      $("cust-order-confirm-box");

    if (!confirmBox) {
      return;
    }

    const totalItems =
      cart.reduce(
        (sum, item) =>
          sum +
          (Number(item.quantity) || 0),
        0
      );

    const total =
      cart.reduce(
        (sum, item) =>
          sum +
          (Number(item.price) || 0) *
            (Number(item.quantity) || 0),
        0
      );

    if (totalItems === 0) {
      confirmBox.hidden = true;
      return;
    }

    confirmBox.hidden = false;

    const countEl =
      $("cust-order-selected-count");

    const totalEl =
      $("cust-order-selected-total");

    if (countEl) {
      countEl.textContent =
        `${totalItems} item${
          totalItems !== 1
            ? "s"
            : ""
        }`;
    }

    if (totalEl) {
      totalEl.textContent =
        SIT_DATA.formatCurrency(
          total
        );
    }
  }

  /* =========================================================
     CHECKOUT
     ========================================================= */

  function proceedToCheckout() {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    const cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    if (cart.length === 0) {
      SIT_APP?.showToast?.(
        "Cart is empty.",
        "error"
      );
      return;
    }

    const lastCustomer =
      SIT_DATA.loadJson(
        "sit_last_cust_details",
        null
      );

    if (lastCustomer) {
      if ($("cust-checkout-name")) {
        $("cust-checkout-name").value =
          lastCustomer.name || "";
      }

      if ($("cust-checkout-phone")) {
        $("cust-checkout-phone").value =
          lastCustomer.phone || "";
      }

      if ($("cust-checkout-address")) {
        $("cust-checkout-address").value =
          lastCustomer.address || "";
      }
    }

    const totalItems =
      cart.reduce(
        (sum, item) =>
          sum +
          (Number(item.quantity) || 0),
        0
      );

    const subtotal =
      cart.reduce(
        (sum, item) =>
          sum +
          (Number(item.price) || 0) *
            (Number(item.quantity) || 0),
        0
      );

    if ($("checkout-recap-count")) {
      $("checkout-recap-count").textContent =
        `${totalItems} items`;
    }

    if ($("checkout-recap-total")) {
      $("checkout-recap-total").textContent =
        SIT_DATA.formatCurrency(
          subtotal
        );
    }

    switchView(
      "cust-view-checkout"
    );
  }

  /* =========================================================
     PLACE ORDER — BACKEND
     ========================================================= */

  async function handleCheckoutSubmit(event) {
    event.preventDefault();

    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    const cart =
      SIT_DATA.getCartByShopId(
        profile.shopId
      );

    if (cart.length === 0) {
      SIT_APP?.showToast?.(
        "Cart is empty.",
        "error"
      );
      return;
    }

    const name =
      $("cust-checkout-name")
        ?.value
        .trim() || "";

    const phone =
      $("cust-checkout-phone")
        ?.value
        .trim() || "";

    const address =
      $("cust-checkout-address")
        ?.value
        .trim() || "";

    const notes =
      $("cust-checkout-notes")
        ?.value
        .trim() || "";

    if (!name || !phone || !address) {
      SIT_APP?.showToast?.(
        "Please complete all delivery fields.",
        "error"
      );
      return;
    }

    const orderItems =
      cart.map((item) => ({
        productId:
          item.productId,
        quantity:
          Number(item.quantity) || 1
      }));

    const submitButton =
      document.querySelector(
        '#cust-checkout-form button[type="submit"]'
      );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent =
        "Placing Order...";
    }

    try {
      const lastCustomer = SIT_DATA.loadJson("sit_last_cust_details", null);
      const postPayload = {
        customerName: name,
        customerPhone: phone,
        customerAddress: address,
        items: orderItems,
        notes,
        paymentMethod: "Pay on Delivery / UPI"
      };

      if (lastCustomer?.customerId) {
        postPayload.customerId = Number(lastCustomer.customerId);
      }

      const response =
        await fetch(
          `${API_BASE_URL}/api/shops/${encodeURIComponent(
            profile.shopId
          )}/orders`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify(postPayload)
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Could not place order."
        );
      }

      const newOrder =
        data?.order;

      if (!newOrder) {
        throw new Error(
          "Server did not return the created order."
        );
      }

      /*
       * IMPORTANT:
       * Keep the exact backend order in memory.
       * The bill can use this object directly.
       */
      currentCreatedOrder =
        newOrder;

      /*
       * Remember customer details
       * for the next checkout.
       */
      SIT_DATA.saveJson(
        "sit_last_cust_details",
        {
          customerId: newOrder.customerId || (lastCustomer?.customerId ? Number(lastCustomer.customerId) : null),
          name,
          phone,
          address
        }
      );

      /*
       * Remember the active order ID.
       */
      localStorage.setItem(
        SIT_DATA.STORAGE_KEYS.ACTIVE_CUST_ORDER,
        String(newOrder.id)
      );

      /*
       * Clear cart only after
       * backend accepted the order.
       */
      SIT_DATA.saveCartByShopId(
        profile.shopId,
        []
      );

      /*
       * Update current UI behind
       * the confirmation modal.
       *
       * DO NOT call switchView("cust-view-shop")
       * here.
       */
      const confirmationModal =
        $("cust-order-confirmed-modal");

      if (confirmationModal) {

        if ($("confirmed-shop-name")) {
          $("confirmed-shop-name").textContent =
            newOrder.shopName ||
            profile.shopName ||
            "Local Shop";
        }

        if ($("confirmed-order-id")) {
          $("confirmed-order-id").textContent =
            `#${newOrder.id}`;
        }

        const totalItems =
          (newOrder.items || [])
            .reduce(
              (sum, item) =>
                sum +
                (Number(item.quantity) || 0),
              0
            );

        if ($("confirmed-order-items")) {
          $("confirmed-order-items").textContent =
            `${totalItems} item${
              totalItems !== 1
                ? "s"
                : ""
            }`;
        }

        if ($("confirmed-order-total")) {
          $("confirmed-order-total").textContent =
            SIT_DATA.formatCurrency(
              newOrder.total
            );
        }

        /*
         * Show confirmation.
         * Nothing after this should
         * hide it automatically.
         */
        confirmationModal.hidden =
          false;

      } else {
        /*
         * Fallback only if the HTML
         * confirmation modal doesn't exist.
         */
        switchView(
          "cust-view-track"
        );
      }

      renderCatalog();
      updateOrderConfirmBox();

      SIT_APP?.showToast?.(
        `Order #${newOrder.id} placed successfully.`,
        "success"
      );

    } catch (error) {
      console.error(
        "Failed to place order:",
        error
      );

      SIT_APP?.showToast?.(
        error.message ||
          "Unable to place order.",
        "error"
      );

    } finally {
      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          submitButton.dataset.originalText ||
          "Confirm & Place Order";
      }
    }
  }

    /* =========================================================
     LIVE ORDER TRACKING
     ========================================================= */

  async function fetchShopOrders(shopId) {
    if (!shopId) {
      return [];
    }

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/shops/${encodeURIComponent(
            shopId
          )}/orders`
        );

      if (!response.ok) {
        throw new Error(
          "Unable to load orders."
        );
      }

      const payload =
        await response.json();

      return normalizeOrders(
        payload
      );

    } catch (error) {
      console.warn(
        "Unable to load orders from server:",
        error
      );

      /*
       * Fallback only for displaying
       * previously cached orders.
       */
      return SIT_DATA.getOrdersByShopId(
        shopId
      );
    }
  }

  function getActiveOrderFromList(
    orders
  ) {
    const activeId =
      localStorage.getItem(
        SIT_DATA.STORAGE_KEYS
          .ACTIVE_CUST_ORDER
      );

    if (!activeId) {
      return null;
    }

    return (
      orders.find(
        (order) =>
          Number(order.id) ===
          Number(activeId)
      ) || null
    );
  }

  function getCustomerOrders(orders) {
    const details =
      SIT_DATA.loadJson(
        "sit_last_cust_details",
        null
      );

    if (!details) {
      return [];
    }

    const targetCustomerId = details.customerId ? Number(details.customerId) : null;
    const targetPhone = details.phone ? String(details.phone).trim() : null;

    if (!targetCustomerId && !targetPhone) {
      return [];
    }

    return orders.filter((order) => {
      if (targetCustomerId && order.customerId && Number(order.customerId) === targetCustomerId) {
        return true;
      }
      if (targetPhone && String(order.customerPhone || "").trim() === targetPhone) {
        return true;
      }
      return false;
    });
  }

  function renderEmptyTracking(
    container,
    myOrdersList
  ) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">

          <div
            class="empty-state-icon"
          >
            <i data-lucide="package"></i>
          </div>

          <h3>
            No active orders to track
          </h3>

          <p>
            Browse our catalog to place an order.
          </p>

          <button
            type="button"
            class="btn btn-primary btn-sm mt-2"
            id="btn-track-start-shopping"
          >
            Browse Catalog
          </button>

        </div>
      `;

      $("btn-track-start-shopping")
        ?.addEventListener(
          "click",
          () =>
            switchView(
              "cust-view-shop"
            )
        );
    }

    if (myOrdersList) {
      myOrdersList.innerHTML = "";
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /* =========================================================
     CUSTOMER ORDER CANCELLATION
     ========================================================= */

  async function cancelCustomerOrder(
  orderId,
  customerPhone,
  cancelBtn
) {
    const profile = resolveShop();
    if (!profile || !profile.shopId || !orderId) {
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to cancel order #${orderId}?`);
    if (!confirmed) {
      return;
    }

    if (cancelBtn) {
  cancelBtn.disabled = true;
  cancelBtn.textContent = "Cancelling...";
}

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/shops/${encodeURIComponent(profile.shopId)}/orders/${encodeURIComponent(orderId)}/cancel`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
  customerPhone: customerPhone || ""
})
  }
);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel order.");
      }

      if (currentCreatedOrder && Number(currentCreatedOrder.id) === Number(orderId)) {
        currentCreatedOrder.status = "cancelled";
      }

      SIT_APP?.showToast?.(`Order #${orderId} has been cancelled.`, "default");

      stopTrackingPoll();
      await renderTracking();
    } catch (err) {
      console.error("Cancellation error:", err);
      SIT_APP?.showToast?.(err.message || "Failed to cancel order.", "error");
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.innerHTML = `<i data-lucide="x-circle"></i> <span>Cancel Order</span>`;
        if (window.lucide) {
          lucide.createIcons();
        }
      }
    }
  }

  function renderTrackingOrder(
  container,
  order,
  profile
) {
  if (!container || !order) {
    return;
  }

  const statusLabels = {
    received: "Received",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled"
  };

  const itemsHtml =
    (order.items || [])
      .map((item) => {
        const price =
          Number(item.price) || 0;

        const quantity =
          Number(item.quantity) || 0;

        const total =
          Number(
            item.total ??
            (price * quantity)
          ) || 0;

        return `
          <div
            style="
              display: flex;
              justify-content: space-between;
              gap: 1rem;
              padding: 0.35rem 0;
              font-size: 0.84rem;
            "
          >
            <span>
              ${escape(item.name)}
              × ${quantity}
            </span>

            <strong>
              ${SIT_DATA.formatCurrency(total)}
            </strong>
          </div>
        `;
      })
      .join("");

  const calculatedTotal =
    (order.items || []).reduce(
      (sum, item) =>
        sum +
        (
          Number(
            item.total ??
            (
              Number(item.price) *
              Number(item.quantity)
            )
          ) || 0
        ),
      0
    );

  const orderTotal =
    Number(order.total) ||
    calculatedTotal;

  const canCancel =
    (
      order.status === "received" ||
      order.status === "accepted"
    ) &&
    order.paymentStatus === "pending";

  const cancelButton = canCancel
    ? `
      <button
        type="button"
        class="btn btn-outline btn-xs btn-cust-cancel-order"
        style="
          color: var(--rose-text);
          border-color: var(--rose-border);
        "
      >
        <i data-lucide="x-circle"></i>
        <span>Cancel Order</span>
      </button>
    `
    : "";

  container.innerHTML = `
    <article
      class="card"
      style="
        padding: 1rem;
        margin-bottom: 1rem;
      "
    >

      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.75rem;
        "
      >
        <div>
          <h3
            style="
              margin: 0;
              font-size: 1rem;
              font-weight: 800;
            "
          >
            Order #${escape(order.id)}
          </h3>

          <p
            class="text-muted"
            style="
              margin: 0.2rem 0 0;
              font-size: 0.76rem;
            "
          >
            ${SIT_DATA.formatDate(order.createdAt)}
            •
            ${SIT_DATA.formatTime(order.createdAt)}
          </p>
        </div>

        <strong
          style="
            font-size: 1rem;
            color: var(--primary);
            white-space: nowrap;
          "
        >
          ${SIT_DATA.formatCurrency(orderTotal)}
        </strong>
      </div>

      <div
        style="
          border-top: 1px dashed var(--border-subtle);
          border-bottom: 1px dashed var(--border-subtle);
          padding: 0.6rem 0;
          margin-bottom: 0.75rem;
        "
      >
        ${itemsHtml}
      </div>

      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        "
      >
        <span
          style="
            font-size: 0.8rem;
            font-weight: 700;
          "
        >
          Order Status
        </span>

        <span
          class="
            status-pill
            status-${escape(order.status)}
          "
        >
          ${escape(
            statusLabels[order.status] ||
            order.status
          )}
        </span>
      </div>

      <div
        style="
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        "
      >
        <button
          type="button"
          class="btn btn-outline btn-xs btn-cust-view-bill"
        >
          <i data-lucide="receipt"></i>
          <span>View Bill</span>
        </button>

        ${cancelButton}
      </div>

    </article>
  `;

  container
    .querySelector(".btn-cust-view-bill")
    ?.addEventListener(
      "click",
      () => {
        SIT_BILL.open(
          order,
          profile.shopId
        );
      }
    );

  container
    .querySelector(".btn-cust-cancel-order")
    ?.addEventListener(
      "click",
      () => {
        cancelCustomerOrder(order.id);
      }
    );

  if (window.lucide) {
    lucide.createIcons();
  }
}

  function renderPastOrders(
  myOrdersList,
  orders,
  activeOrder
) {
  if (!myOrdersList) {
    return;
  }

  myOrdersList.innerHTML = "";

  const pastOrders =
    [...orders]
      .filter(
        (order) =>
          Number(order.id) !==
          Number(activeOrder?.id)
      )
      .reverse();

  if (pastOrders.length === 0) {
    return;
  }

  pastOrders.forEach((order) => {
    const element =
      document.createElement("article");

    element.className = "card";

    element.style.padding = "1rem";
    element.style.marginBottom = "0.75rem";

    const orderItems =
      (order.items || [])
        .map((item) => {
          const price =
            Number(item.price) || 0;

          const quantity =
            Number(item.quantity) || 0;

          const total =
            Number(
              item.total ??
              (price * quantity)
            ) || 0;

          return `
            <div
              style="
                display: flex;
                justify-content: space-between;
                gap: 1rem;
                padding: 0.3rem 0;
                font-size: 0.84rem;
              "
            >
              <span>
                ${escape(item.name)}
                × ${quantity}
              </span>

              <strong>
                ${SIT_DATA.formatCurrency(total)}
              </strong>
            </div>
          `;
        })
        .join("");

    const calculatedTotal =
      (order.items || []).reduce(
        (sum, item) =>
          sum +
          (
            Number(
              item.total ??
              (
                Number(item.price) *
                Number(item.quantity)
              )
            ) || 0
          ),
        0
      );

    const orderTotal =
      Number(order.total) ||
      calculatedTotal;

    const canCancel =
      (
        order.status === "received" ||
        order.status === "accepted"
      ) &&
      order.paymentStatus === "pending";

    element.innerHTML = `
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.75rem;
        "
      >

        <div>
          <h3
            style="
              margin: 0;
              font-size: 1rem;
              font-weight: 800;
            "
          >
            Order #${escape(order.id)}
          </h3>

          <p
            class="text-muted"
            style="
              margin: 0.2rem 0 0;
              font-size: 0.76rem;
            "
          >
            ${SIT_DATA.formatDate(order.createdAt)}
            •
            ${SIT_DATA.formatTime(order.createdAt)}
          </p>
        </div>

        <strong
          style="
            font-size: 1rem;
            color: var(--primary);
            white-space: nowrap;
          "
        >
          ${SIT_DATA.formatCurrency(orderTotal)}
        </strong>

      </div>

      <div
        style="
          border-top: 1px dashed var(--border-subtle);
          border-bottom: 1px dashed var(--border-subtle);
          padding: 0.6rem 0;
          margin-bottom: 0.75rem;
        "
      >
        ${orderItems}
      </div>

      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        "
      >

        <span
          style="
            font-size: 0.8rem;
            font-weight: 700;
          "
        >
          Order Status
        </span>

        <span
          class="
            status-pill
            status-${escape(order.status)}
          "
        >
          ${escape(order.status)}
        </span>

      </div>

      <div
        style="
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        "
      >

        <button
          type="button"
          class="btn btn-outline btn-xs btn-past-view-bill"
        >
          <i data-lucide="receipt"></i>
          <span>View Bill</span>
        </button>

        ${
          canCancel
            ? `
              <button
                type="button"
                class="btn btn-outline btn-xs btn-past-cancel-order"
                style="
                  color: var(--rose-text);
                  border-color: var(--rose-border);
                "
              >
                <i data-lucide="x-circle"></i>
                <span>Cancel Order</span>
              </button>
            `
            : ""
        }

      </div>
    `;

    element
      .querySelector(".btn-past-view-bill")
      ?.addEventListener(
        "click",
        () => {
          const profile =
            resolveShop();

          if (!profile) {
            return;
          }

          SIT_BILL.open(
            order,
            profile.shopId
          );
        }
      );

    const pastCancelBtn =
  element.querySelector(
    ".btn-past-cancel-order"
  );

pastCancelBtn?.addEventListener(
  "click",
  () => {
    cancelCustomerOrder(
      order.id,
      order.customerPhone,
      pastCancelBtn
    );
  }
);

    myOrdersList.appendChild(
      element
    );
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

  async function renderTracking() {
    const profile =
      resolveShop();

    if (!profile) {
      return;
    }

    const container =
      $("cust-track-order-details");

    const myOrdersList =
      $("cust-my-orders-list");

    if (!container) {
      return;
    }

    const orders =
      await fetchShopOrders(
        profile.shopId
      );

    let activeOrder =
      currentCreatedOrder;

    /*
     * Prefer the freshly-created
     * backend order while it exists, but sync with latest server state.
     */
    if (activeOrder) {
      const freshActive = orders.find((o) => Number(o.id) === Number(activeOrder.id));
      if (freshActive) {
        currentCreatedOrder = freshActive;
        activeOrder = freshActive;
      }
    } else {
      activeOrder =
        getActiveOrderFromList(
          orders
        );
    }

    const customerOrders =
      getCustomerOrders(
        orders
      );

    /*
     * If no active order exists,
     * use the customer's latest order.
     */
    if (
      !activeOrder &&
      customerOrders.length > 0
    ) {
      activeOrder =
        customerOrders[
          customerOrders.length - 1
        ];
    }

    if (!activeOrder) {
      renderEmptyTracking(
        container,
        myOrdersList
      );
      stopTrackingPoll();
      return;
    }

    renderTrackingOrder(
      container,
      activeOrder,
      profile
    );

    renderPastOrders(
      myOrdersList,
      customerOrders.length > 0
        ? customerOrders
        : orders,
      activeOrder
    );

    if (activeOrder.status === "completed" || activeOrder.status === "cancelled") {
      stopTrackingPoll();
    }
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

    /*
     * Navigation tabs
     */
    document
      .querySelectorAll(
        ".cust-nav-tab"
      )
      .forEach((tab) => {
        tab.addEventListener(
          "click",
          () => {
            switchView(
              tab.dataset.custView
            );
          }
        );
      });


     /*
 * Track Orders button
 */
$("btn-view-track-orders")
  ?.addEventListener(
    "click",
    () => {
      switchView(
        "cust-view-track"
      );
    }
  );

    /*
     * Category filters
     */
    document
      .querySelectorAll(".cat-chip")
      .forEach((chip) => {
        chip.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(
                ".cat-chip"
              )
              .forEach((item) => {
                item.classList.remove(
                  "active"
                );
              });

            chip.classList.add(
              "active"
            );

            currentCategory =
              chip.dataset.custCat ||
              "all";

            renderCatalog();
          }
        );
      });

    /*
     * Main Confirm Order button
     */
    $("btn-confirm-order")
      ?.addEventListener(
        "click",
        proceedToCheckout
      );

    /*
     * Checkout back button
     */
    $("btn-cust-back-to-products")
      ?.addEventListener(
        "click",
        () => {
          switchView(
            "cust-view-shop"
          );
        }
      );

    /*
     * Checkout form submission
     */
    $("cust-checkout-form")
      ?.addEventListener(
        "submit",
        handleCheckoutSubmit
      );

    /*
     * Back to store list
     */
    $("btn-back-to-all-stores")
  ?.addEventListener(
    "click",
    () => {
      showDashboard();
    }
  );

    /*
     * Confirmation modal → View Bill
     *
     * IMPORTANT:
     * We do NOT switch to Products here.
     * We directly open the bill using
     * the exact backend-created order.
     */
    $("btn-confirmed-view-bill")
      ?.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          const order =
            currentCreatedOrder;

          const profile =
            resolveShop();

          if (!order || !profile) {
            SIT_APP?.showToast?.(
              "Order details are unavailable.",
              "error"
            );

            return;
          }

          SIT_BILL.open(
            order,
            profile.shopId
          );

          /*
           * Hide confirmation only
           * AFTER the bill has been
           * given the order data.
           */
          const modal =
            $("cust-order-confirmed-modal");

          if (modal) {
            modal.hidden = true;
          }
        }
      );

    /*
     * Confirmation modal → Back to Products
     */
    const handleBackToProducts = (event) => {
      event?.preventDefault?.();
      const modal = $("cust-order-confirmed-modal");
      if (modal) {
        modal.hidden = true;
      }
      switchView("cust-view-shop");
    };

    $("btn-confirmed-back-to-products")?.addEventListener(
  "click",
  handleBackToProducts
);

    /*
     * Confirmation modal → Track Order
     */
    $("btn-confirmed-track-order")?.addEventListener(
      "click",
      (event) => {
        event?.preventDefault?.();
        const modal = $("cust-order-confirmed-modal");
        if (modal) {
          modal.hidden = true;
        }
        switchView("cust-view-track");
      }
    );

    /*
     * Tracking view → Back to Products
     */
    $("btn-track-back-to-shop")?.addEventListener(
      "click",
      () => {
        switchView("cust-view-shop");
      }
    );
  }

    /* =========================================================
     INITIALIZATION
     ========================================================= */

  async function init() {
    bindEvents();

    const shopId =
      getShopIdFromUrl();

    /*
     * No shop in URL:
     * show the customer store dashboard.
     */
    if (!shopId) {
      showDashboard();
      return;
    }

    /*
     * A shop was selected:
     * load its profile from backend.
     */
    const profile =
      await fetchShopProfile(
        shopId
      );

    /*
     * Backend could not find
     * this shop.
     */
    if (!profile) {
      const notFound =
        $("cust-shop-not-found");

      const main =
        $("cust-main-content");

      if (notFound) {
        notFound.hidden = false;
      }

      const message =
        $("cust-not-found-msg");

      if (message) {
        message.textContent =
          `Could not find any storefront registered with ID "${shopId}".`;
      }

      if (main) {
        main.hidden = true;
      }

      return;
    }

    /*
     * Valid shop.
     */
    const notFound =
      $("cust-shop-not-found");

    const main =
      $("cust-main-content");

    if (notFound) {
      notFound.hidden = true;
    }

    if (main) {
      main.hidden = false;
    }

    /*
     * Make sure the correct
     * storefront view is visible.
     */
    setView(
      "cust-view-shop"
    );

    renderHeader();

    /*
     * Load backend products.
     */
    await renderCatalog();
    
    /*
     * Tracking is rendered
     * asynchronously.
     */
    renderTracking();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  return {
    init,
    switchView,
    renderCatalog,
    renderTracking,
    addToCart,
    clearCart
  };

})();