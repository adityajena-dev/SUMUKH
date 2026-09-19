/* ========================================================
   SIT — CUSTOMER LANDING PAGE
======================================================== */

const SIT_LANDING = (() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function getShopId() {
    const params = new URLSearchParams(
      window.location.search
    );

    return params.get("shop");
  }

  function showNotFound(message) {
    const landingPage = document.querySelector(".landing-page");
    const errorSection = $("landing-not-found");

    if (landingPage) {
      landingPage.hidden = true;
    }

    if (errorSection) {
      errorSection.hidden = false;
    }

    if ($("landing-error-message")) {
      $("landing-error-message").textContent =
        message ||
        "We could not find the shop requested by this QR code.";
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function renderShop(profile) {
    if (!profile) {
      showNotFound();
      return;
    }

    const shopName =
      profile.shopName || "Local Shop";

    const address =
      profile.address || "Local Market";

    if ($("landing-shop-name")) {
      $("landing-shop-name").textContent = shopName;
    }

    if ($("landing-shop-address")) {
      $("landing-shop-address").textContent = address;
    }
  }

  function startOrdering() {
    const shopId = getShopId();

    if (!shopId) {
      showNotFound(
        "This storefront link does not contain a shop ID."
      );
      return;
    }

    window.location.href =
      `shop.html?shop=${encodeURIComponent(shopId)}`;
  }

  function bindEvents() {
    $("btn-start-ordering")?.addEventListener(
      "click",
      startOrdering
    );
  }

  async function init() {
    const shopId = getShopId();

    bindEvents();

    if (!shopId) {
      showNotFound(
        "This storefront link is missing a shop ID."
      );
      return;
    }

    try {
      const response = await fetch(
        `${SUMUKH_CONFIG.API_BASE_URL}/api/shops/${encodeURIComponent(shopId)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          showNotFound(
            `Could not find shop "${shopId}".`
          );
        } else {
          showNotFound(
            "Unable to load shop information."
          );
        }

        return;
      }

      const data = await response.json();

      if (!data.shop) {
        showNotFound(
          "Shop information could not be loaded."
        );
        return;
      }

      renderShop(data.shop);

    } catch (error) {
      console.error(
        "Failed to load shop:",
        error
      );

      showNotFound(
        "Unable to connect to the SUMUKH server."
      );
    }
  }

  return {
    init
  };

})();