/* ==========================================================================
   SIT — INVOICE GENERATOR & PAYMENT QR (js/bill.js)
   Printable tax invoice, pure SVG QR generator, receipt download & share
   ========================================================================== */

const SIT_BILL = (function () {
  "use strict";

  const API_BASE_URL = SUMUKH_CONFIG.API_BASE_URL;

  let currentModalOrderId = null;
  let currentModalOrder = null;

  function renderQrCode(containerElement, textData) {
    if (!containerElement) return;
    containerElement.innerHTML = "";

    const encoded = encodeURIComponent(textData);
    const img = document.createElement("img");

img.crossOrigin = "anonymous";
img.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encoded}&margin=2`;
img.alt = "Payment QR Code";
img.loading = "eager";

    // Offline SVG QR placeholder fallback
    img.onerror = () => {
      containerElement.innerHTML = `
        <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#ffffff" />
          <rect x="10" y="10" width="26" height="26" fill="#0f172a" />
          <rect x="14" y="14" width="18" height="18" fill="#ffffff" />
          <rect x="18" y="18" width="10" height="10" fill="#0f172a" />
          <rect x="64" y="10" width="26" height="26" fill="#0f172a" />
          <rect x="68" y="14" width="18" height="18" fill="#ffffff" />
          <rect x="72" y="18" width="10" height="10" fill="#0f172a" />
          <rect x="10" y="64" width="26" height="26" fill="#0f172a" />
          <rect x="14" y="68" width="18" height="18" fill="#ffffff" />
          <rect x="18" y="72" width="10" height="10" fill="#0f172a" />
          <rect x="42" y="15" width="8" height="8" fill="#0f172a" />
          <rect x="46" y="28" width="8" height="8" fill="#0f172a" />
          <rect x="15" y="44" width="8" height="8" fill="#0f172a" />
          <rect x="28" y="48" width="8" height="8" fill="#0f172a" />
          <rect x="44" y="44" width="12" height="12" fill="#0f172a" />
          <rect x="60" y="42" width="8" height="8" fill="#0f172a" />
          <rect x="74" y="48" width="8" height="8" fill="#0f172a" />
          <rect x="48" y="68" width="8" height="8" fill="#0f172a" />
          <rect x="64" y="64" width="12" height="8" fill="#0f172a" />
          <rect x="80" y="74" width="10" height="10" fill="#0f172a" />
        </svg>
      `;
    };

    containerElement.appendChild(img);
  }

  function open(orderOrId, shopId = null) {
    let order = null;
    let orderId = null;

    if (typeof orderOrId === "object" && orderOrId !== null) {
      order = orderOrId;
      orderId = order.id;
      if (!shopId && order.shopId) {
        shopId = order.shopId;
      }
    } else {
      orderId = Number(orderOrId);
      const orders = shopId
        ? SIT_DATA.getOrdersByShopId(shopId)
        : SIT_DATA.getOrders();
      order = orders.find((o) => Number(o.id) === orderId);
    }

    if (!order) {
      SIT_APP?.showToast?.("Order not found.", "error");
      return;
    }

    currentModalOrderId = orderId;
    currentModalOrder = order;

    const baseProfile = shopId
      ? (SIT_DATA.getShopById(shopId) || SIT_DATA.getStoreProfile())
      : SIT_DATA.getStoreProfile();

    const profile = {
      ...baseProfile,
      shopName: order.shopName || baseProfile.shopName,
      address: order.shopAddress || baseProfile.address,
      phone: order.shopPhone || baseProfile.phone,
      upiId: order.upiId || baseProfile.upiId
    };

    const $ = (id) => document.getElementById(id);

    // Populate Store Header
    if ($("bill-shop-name")) $("bill-shop-name").textContent = profile.shopName;
    if ($("bill-shop-address")) $("bill-shop-address").textContent = profile.address;
    if ($("bill-shop-phone")) $("bill-shop-phone").textContent = `Ph: ${profile.phone}`;

    // Order Metadata
    if ($("bill-order-id")) $("bill-order-id").textContent = `#${order.id}`;
    if ($("bill-order-date")) $("bill-order-date").textContent = SIT_DATA.formatDate(order.createdAt);
    if ($("bill-order-time")) $("bill-order-time").textContent = SIT_DATA.formatTime(order.createdAt);

    const statusEl = $("bill-order-status");
    if (statusEl) {
      statusEl.textContent = order.status;
      statusEl.className = `status-pill status-${order.status}`;
    }

    // Customer Info
    if ($("bill-cust-name")) $("bill-cust-name").textContent = order.customerName;
    if ($("bill-cust-phone")) $("bill-cust-phone").textContent = `Phone: ${order.customerPhone || "N/A"}`;
    if ($("bill-cust-address")) $("bill-cust-address").textContent = order.customerAddress || "N/A";

    if ($("bill-payment-method")) $("bill-payment-method").textContent = order.paymentMethod || "Cash on Delivery";
    const payBadge = $("bill-payment-badge");
    if (payBadge) {
      payBadge.textContent = order.paymentStatus === "paid" ? "PAID" : "PENDING";
      payBadge.className = `pay-status-pill pay-status-${order.paymentStatus}`;
    }

    // Line Items Table
    const tbody = $("bill-items-tbody");
    if (tbody) {
      tbody.innerHTML = "";
      (order.items || []).forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td class="font-bold">${SIT_DATA.escapeHtml(item.name)}</td>
          <td class="text-right">${SIT_DATA.formatCurrency(item.price)}</td>
          <td class="text-center font-bold">${item.quantity}</td>
          <td class="text-right font-bold">
  ${SIT_DATA.formatCurrency(
    Number(item.total ?? (Number(item.price) * Number(item.quantity))) || 0
  )}
</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const calculatedSubtotal = (order.items || []).reduce(
  (sum, item) =>
    sum +
    (
      Number(item.total ?? (Number(item.price) * Number(item.quantity))) || 0
    ),
  0
);

const subtotal =
  Number(order.subtotal) ||
  calculatedSubtotal;

if ($("bill-calc-subtotal")) {
  $("bill-calc-subtotal").textContent =
    SIT_DATA.formatCurrency(subtotal);
}
    const grandTotal = Number(order.total) || subtotal;
    if ($("bill-calc-grand-total")) $("bill-calc-grand-total").textContent = SIT_DATA.formatCurrency(grandTotal);

    // Payment QR Code Box
    if ($("bill-qr-amount")) $("bill-qr-amount").textContent = SIT_DATA.formatCurrency(grandTotal);
    if ($("bill-qr-upi-id")) $("bill-qr-upi-id").textContent = profile.upiId;

    const upiUri = `upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.shopName)}&am=${order.total}&cu=INR&tn=Order_${order.id}`;
    renderQrCode($("bill-qr-box"), upiUri);

    const modal = $("bill-modal");
    if (modal) modal.hidden = false;
  }

  function openPreview(customData) {
    if (!customData || !customData.items || customData.items.length === 0) {
      SIT_APP?.showToast?.("No items to bill.", "error");
      return;
    }

    currentModalOrderId = customData.id || "PREVIEW";
    const profile = SIT_DATA.getStoreProfile();
    const $ = (id) => document.getElementById(id);

    if ($("bill-shop-name")) $("bill-shop-name").textContent = profile.shopName;
    if ($("bill-shop-address")) $("bill-shop-address").textContent = profile.address;
    if ($("bill-shop-phone")) $("bill-shop-phone").textContent = `Ph: ${profile.phone}`;

    if ($("bill-order-id")) $("bill-order-id").textContent = `#${customData.id || "NEW"}`;
    if ($("bill-order-date")) $("bill-order-date").textContent = SIT_DATA.formatDate(new Date().toISOString());
    if ($("bill-order-time")) $("bill-order-time").textContent = SIT_DATA.formatTime(new Date().toISOString());

    const statusEl = $("bill-order-status");
    if (statusEl) {
      statusEl.textContent = customData.status || "Quote / New";
      statusEl.className = `status-pill status-accepted`;
    }

    if ($("bill-cust-name")) $("bill-cust-name").textContent = customData.customerName || "Walk-in Customer";
    if ($("bill-cust-phone")) $("bill-cust-phone").textContent = `Phone: ${customData.customerPhone || "N/A"}`;
    if ($("bill-cust-address")) $("bill-cust-address").textContent = customData.customerAddress || "In-store Pickup";

    if ($("bill-payment-method")) $("bill-payment-method").textContent = customData.paymentMethod || "Pending (UPI / Cash)";
    const payBadge = $("bill-payment-badge");
    if (payBadge) {
      payBadge.textContent = "PENDING";
      payBadge.className = "pay-status-pill pay-status-pending";
    }

    const tbody = $("bill-items-tbody");
    if (tbody) {
      tbody.innerHTML = "";
      customData.items.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td class="font-bold">${SIT_DATA.escapeHtml(item.name)}</td>
          <td class="text-right">${SIT_DATA.formatCurrency(item.price)}</td>
          <td class="text-center font-bold">${item.quantity}</td>
          <td class="text-right font-bold">${SIT_DATA.formatCurrency(Number(item.total ?? (Number(item.price) * Number(item.quantity))) || 0)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const subtotal = Number(customData.subtotal) || customData.items.reduce((s, i) => s + (Number(i.total ?? (Number(i.price) * Number(i.quantity))) || 0), 0);
    const total = Number(customData.total) || subtotal;

    if ($("bill-calc-subtotal")) $("bill-calc-subtotal").textContent = SIT_DATA.formatCurrency(subtotal);
    if ($("bill-calc-grand-total")) $("bill-calc-grand-total").textContent = SIT_DATA.formatCurrency(total);

    if ($("bill-qr-amount")) $("bill-qr-amount").textContent = SIT_DATA.formatCurrency(total);
    if ($("bill-qr-upi-id")) $("bill-qr-upi-id").textContent = profile.upiId;

    const upiUri = `upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.shopName)}&am=${total}&cu=INR&tn=Invoice_${customData.id || "Quote"}`;
    renderQrCode($("bill-qr-box"), upiUri);

    const modal = $("bill-modal");
    if (modal) modal.hidden = false;
  }

  async function markAsPaid(orderId) {
  if (!orderId || orderId === "PREVIEW") {
    SIT_APP?.showToast?.("Invoice is in preview mode.", "default");
    return;
  }

  const orders = SIT_DATA.getOrders();
  const ord = orders.find((o) => o.id === Number(orderId));

  if (!ord) {
    SIT_APP?.showToast?.("Order not found.", "error");
    return;
  }

  if (ord.paymentStatus === "paid") {
    SIT_APP?.showToast?.("This order is already PAID.", "default");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/shops/${ord.shopId}/orders/${ord.id}/payment`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentStatus: "paid",
          paymentMethod: "UPI"
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
    `Payment verification failed (${response.status})`
  );
}

    const updatedOrder = data.order;

    const index = orders.findIndex(
      (o) => o.id === Number(orderId)
    );

    if (index !== -1) {
      orders[index] = updatedOrder;
      SIT_DATA.saveOrders(orders);
      window.dispatchEvent(
        new CustomEvent("sit:order-updated", {
          detail: { order: updatedOrder }
        })
      );
    }

    SIT_APP?.showToast?.(
      `✓ Order #${orderId} marked as PAID.`,
      "success"
    );

    open(orderId);
  } catch (error) {
    console.error("Mark payment paid error:", error);

    SIT_APP?.showToast?.(
      error.message || "Could not mark payment as paid.",
      "error"
    );
  }
}

  function close() {
  const modal = document.getElementById("bill-modal");

  if (modal) {
    modal.hidden = true;
  }

  currentModalOrderId = null;
  currentModalOrder = null;

  window.dispatchEvent(
    new CustomEvent("sit:bill-closed")
  );
}

  function sanitizeFileName(name) {
  return String(name || "Customer")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "Customer";
}

async function downloadReceipt() {
  if (!currentModalOrderId && !currentModalOrder) return;

  const order = currentModalOrder || SIT_DATA.getOrders().find(
    (o) => Number(o.id) === Number(currentModalOrderId)
  );

  const bill = document.getElementById("printable-bill");

  if (!order || !bill) {
    SIT_APP?.showToast?.("Bill could not be generated.", "error");
    return;
  }

  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    SIT_APP?.showToast?.(
      "PDF generator is not loaded. Please refresh the page.",
      "error"
    );
    return;
  }

  try {
    SIT_APP?.showToast?.("Preparing PDF...", "default");

    const canvas = await html2canvas(bill, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false
    });

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const margin = 8;
    const pageWidth = 210;
    const pageHeight = 297;

    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const imageWidth = maxWidth;
    const imageHeight =
      (canvas.height * imageWidth) / canvas.width;

    const finalHeight = Math.min(imageHeight, maxHeight);
    const finalWidth =
      imageHeight > maxHeight
        ? (canvas.width * finalHeight) / canvas.height
        : imageWidth;

    const x = (pageWidth - finalWidth) / 2;
    const y = margin;

    const imageData = canvas.toDataURL("image/jpeg", 0.95);

    pdf.addImage(
      imageData,
      "JPEG",
      x,
      y,
      finalWidth,
      finalHeight
    );

    const customerName = sanitizeFileName(order.customerName);
    const orderNumber = String(order.id);

    pdf.save(`${customerName}_Order_${orderNumber}.pdf`);

    SIT_APP?.showToast?.(
      "✓ PDF saved successfully.",
      "success"
    );
  } catch (error) {
    console.error("PDF generation failed:", error);

    SIT_APP?.showToast?.(
      "Unable to generate PDF.",
      "error"
    );
  }
}
function shareOnWhatsApp() {
  if (!currentModalOrderId && !currentModalOrder) return;

  const order =
    currentModalOrder ||
    SIT_DATA.getOrders().find(
      (o) => Number(o.id) === Number(currentModalOrderId)
    );

  const profile =
    currentModalOrder && currentModalOrder.shopName
      ? {
          shopName: currentModalOrder.shopName,
          upiId:
            currentModalOrder.upiId ||
            SIT_DATA.getStoreProfile().upiId,
          shopId:
            currentModalOrder.shopId ||
            SIT_DATA.getStoreProfile().shopId
        }
      : SIT_DATA.getStoreProfile();

  if (!order) {
    SIT_APP?.showToast?.("Order not found.", "error");
    return;
  }

  const rawPhone = String(order.customerPhone || "").replace(/\D/g, "");

  let whatsappPhone = rawPhone;

  if (whatsappPhone.startsWith("0")) {
    whatsappPhone = "91" + whatsappPhone.slice(1);
  } else if (whatsappPhone.length === 10) {
    whatsappPhone = "91" + whatsappPhone;
  }

  if (!whatsappPhone) {
    SIT_APP?.showToast?.(
      "Customer phone number is missing.",
      "error"
    );
    return;
  }

  let msg =
    `*Bill #${order.id} - ${profile.shopName}*\n\n` +
    `Hello ${order.customerName},\n` +
    `Thank you for ordering with us!\n\n`;

  msg += "*Items:*\n";

(order.items || []).forEach((item) => {
  const itemTotal =
    Number(
      item.total ??
      (Number(item.price) * Number(item.quantity))
    ) || 0;

  msg +=
    `• ${item.name} x ${item.quantity} = ` +
    `${SIT_DATA.formatCurrency(itemTotal)}\n`;
});

msg += `\n*Total:* ${SIT_DATA.formatCurrency(order.total)}\n`;

if (profile.upiId && String(profile.upiId).trim()) {
  const upiUri =
    `upi://pay` +
    `?pa=${encodeURIComponent(profile.upiId.trim())}` +
    `&pn=${encodeURIComponent(profile.shopName || "Shop")}` +
    `&am=${encodeURIComponent(Number(order.total).toFixed(2))}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Order_${order.id}`)}`;

  msg +=
    `\n💳 *Pay via UPI*\n` +
    `Tap the link below to pay ${SIT_DATA.formatCurrency(order.total)}:\n` +
    `${upiUri}\n` +
    `UPI ID: ${profile.upiId.trim()}\n`;
} else {
  msg +=
    `\n*UPI payment is not available for this order.*\n` +
    `Please contact the shop for payment details.\n`;
}

  const shopParam = profile.shopId ? `?shop=${encodeURIComponent(profile.shopId)}` : "";
  const storeUrl =
    `${window.location.origin + window.location.pathname.replace(
      "index.html",
      ""
    )}shop.html${shopParam}`;

  msg += `\nStore Link: ${storeUrl}`;

  const waUrl =
    `https://wa.me/${whatsappPhone}` +
    `?text=${encodeURIComponent(msg)}`;

  window.open(
    waUrl,
    "_blank",
    "noopener,noreferrer"
  );
}

function payViaUpi() {
  if (!currentModalOrderId && !currentModalOrder) return;

  const order =
    currentModalOrder ||
    SIT_DATA.getOrders().find(
      (o) => Number(o.id) === Number(currentModalOrderId)
    );

  if (!order) {
    SIT_APP?.showToast?.("Order not found.", "error");
    return;
  }

  const profile =
    currentModalOrder && currentModalOrder.shopName
      ? {
          shopName: currentModalOrder.shopName,
          upiId:
            currentModalOrder.upiId ||
            SIT_DATA.getStoreProfile().upiId
        }
      : SIT_DATA.getStoreProfile();

  const upiId = String(profile.upiId || "").trim();

  if (!upiId) {
    SIT_APP?.showToast?.(
      "UPI ID is not configured in Settings.",
      "error"
    );
    return;
  }

  const upiUri =
    `upi://pay` +
    `?pa=${encodeURIComponent(upiId)}` +
    `&pn=${encodeURIComponent(profile.shopName || "Shop")}` +
    `&am=${encodeURIComponent(Number(order.total).toFixed(2))}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Order_${order.id}`)}`;

  window.location.href = upiUri;
}

  function printBill() {
  const bill = document.getElementById("printable-bill");

  if (!bill) {
    SIT_APP?.showToast?.("Bill not available.", "error");
    return;
  }

  const printWindow = window.open(
    "",
    "_blank",
    "width=900,height=1100"
  );

  if (!printWindow) {
    SIT_APP?.showToast?.(
      "Please allow pop-ups to print the bill.",
      "error"
    );
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]')
  )
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join("");

  printWindow.document.open();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">

        <title>Bill #${currentModalOrderId}</title>

        ${styles}

        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }

          body {
            min-width: 0 !important;
          }

          .bill-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
          }

          .no-print {
            display: none !important;
          }

          @media print {
            html,
            body {
              width: 100%;
              background: #ffffff !important;
            }

            .bill-sheet {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        ${bill.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  const waitForPrint = async () => {
    try {
      if (printWindow.document.fonts?.ready) {
        await printWindow.document.fonts.ready;
      }
    } catch (_) {
      // Continue even if font loading fails.
    }

    const images = Array.from(
      printWindow.document.images
    );

    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, {
                  once: true
                });

                img.addEventListener("error", resolve, {
                  once: true
                });
              })
      )
    );

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 250);
  };

  waitForPrint();
}

function bindEvents() {
  const $ = (id) => document.getElementById(id);

  $("btn-close-bill-modal")?.addEventListener(
    "click",
    close
  );

  $("btn-modal-close-action")?.addEventListener(
    "click",
    close
  );

  $("btn-print-bill")?.addEventListener(
    "click",
    printBill
  );

  $("btn-download-bill")?.addEventListener(
    "click",
    downloadReceipt
  );

  $("btn-whatsapp-bill")?.addEventListener(
    "click",
    shareOnWhatsApp
  );

  $("btn-mark-paid")?.addEventListener(
  "click",
  () => markAsPaid(currentModalOrderId)
);

}

return {
  open,
  openPreview,
  close,
  renderQrCode,
  downloadReceipt,
  shareOnWhatsApp,
  printBill,
  bindEvents,
  markAsPaid
};

})();
