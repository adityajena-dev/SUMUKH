const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");

const Shop = require("./models/Shop");
const Product = require("./models/Product");
const Customer = require("./models/Customer");
const Order = require("./models/Order");

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

function publicShop(shop) {
  if (!shop) return null;

  const obj =
    typeof shop.toObject === "function"
      ? shop.toObject()
      : { ...shop };

  const {
    _id,
    __v,
    password,
    products,
    orders,
    customers,
    ...profile
  } = obj;

  return {
    id: profile.id !== undefined ? profile.id : undefined,
    shopId:
      profile.shopId ||
      (profile.id !== undefined ? String(profile.id) : ""),
    name: profile.name || profile.shopName || "",
    shopName: profile.shopName || profile.name || "",
    ownerName: profile.ownerName || "",
    phone: profile.phone || profile.ownerPhone || "",
    email: profile.email || profile.username || "",
    address: profile.address || "",
    upiId: profile.upiId || "",
    currency: profile.currency || "₹",
    isOpen: profile.isOpen !== false,
    marketArea: profile.marketArea || "",
    tagline: profile.tagline || "",
    createdAt:
      profile.createdAt ||
      (
        obj.createdAt
          ? new Date(obj.createdAt).toISOString()
          : new Date().toISOString()
      )
  };
}

function error(res, status, message) {
  return res.status(status).json({ error: message });
}

async function resolveShop(rawShopId) {
  const shopId = String(rawShopId || "").trim();

  if (!shopId) {
    return null;
  }

  const isNumeric = /^\d+$/.test(shopId);

  const shop = await Shop.findOne(
    isNumeric
      ? {
          $or: [
            { id: Number(shopId) },
            { shopId }
          ]
        }
      : { shopId }
  ).lean();

  return shop || null;
}

app.get("/api/health", (req, res) => res.json({ status: "ok", message: "SUMUKH server is running" }));

app.get("/api/shops", async (req, res) => {
  try {
    const mongoShops = await Shop.find()
      .sort({ id: 1 })
      .lean();

    return res.json(mongoShops.map(publicShop));
  } catch (err) {
    console.error("Fetch shops error:", err);
    return error(
      res,
      500,
      "Internal server error retrieving shops"
    );
  }
});

app.post("/api/shops", async (req, res) => {
  try {
    const { shopId, ownerName, shopName, phone, email, password, address, upiId = "" } = req.body || {};
    if (![shopId, ownerName, shopName, phone, email, password, address].every((value) => String(value || "").trim())) {
      return error(res, 400, "Shop ID, owner name, shop name, phone, email, password, and address are required");
    }

    const cleanId = String(shopId).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    const cleanShopName = String(shopName).trim();
    const cleanOwnerName = String(ownerName).trim();
    const cleanAddress = String(address).trim();
    const cleanUpiId = String(upiId || "").trim();

    const existing = await Shop.findOne({
      $or: [
        { shopId: cleanId },
        { email: cleanEmail },
        { username: cleanEmail },
        { phone: cleanPhone },
        { ownerPhone: cleanPhone }
      ]
    });

    if (existing) {
      return error(res, 409, "An account already exists with this email, phone, or shop ID");
    }

    const lastShop = await Shop.findOne().sort({ id: -1 }).select("id").lean();
    const nextNumericId = lastShop && Number.isFinite(lastShop.id) ? lastShop.id + 1 : 1;

    const shop = await Shop.create({
      id: nextNumericId,
      shopId: cleanId,
      name: cleanShopName,
      shopName: cleanShopName,
      ownerName: cleanOwnerName,
      phone: cleanPhone,
      ownerPhone: cleanPhone,
      username: cleanEmail,
      email: cleanEmail,
      password: String(password),
      address: cleanAddress,
      upiId: cleanUpiId,
      currency: "₹",
      isOpen: true,
      marketArea: "",
      tagline: ""
    });

    res.status(201).json({ success: true, shop: publicShop(shop) });
  } catch (err) {
    console.error("Create shop error:", err);
    return error(res, 500, "Internal server error creating shop");
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const normalized = identifier.toLowerCase();
    const phone = identifier.replace(/\s+/g, "");

    const shop = await Shop.findOne({
      $or: [
        { email: normalized },
        { username: normalized },
        { username: identifier },
        { phone: phone },
        { ownerPhone: phone }
      ]
    });

    if (!shop || shop.password !== password) {
      return error(res, 401, "Invalid email/phone or password");
    }

    res.json({ success: true, shop: publicShop(shop) });
  } catch (err) {
    console.error("Login error:", err);
    return error(res, 500, "Internal server error during login");
  }
});

app.get("/api/shops/:shopId", async (req, res) => {
  try {
    const rawParam = String(req.params.shopId || "").trim();
    const isNumeric = /^\d+$/.test(rawParam);
    const query = isNumeric
      ? { $or: [{ id: Number(rawParam) }, { shopId: rawParam }] }
      : { shopId: rawParam };
    const shop = await Shop.findOne(query);
    if (!shop) {
      return error(res, 404, "Shop not found");
    }
    return res.json({ success: true, shop: publicShop(shop) });
  } catch (err) {
    console.error("Get shop error:", err);
    return error(res, 500, "Internal server error retrieving shop");
  }
});

app.patch("/api/shops/:shopId", async (req, res) => {
  try {
    const rawParam = String(req.params.shopId || "").trim();
    const isNumeric = /^\d+$/.test(rawParam);
    const query = isNumeric
      ? { $or: [{ id: Number(rawParam) }, { shopId: rawParam }] }
      : { shopId: rawParam };
    const shop = await Shop.findOne(query);
    if (!shop) {
      return error(res, 404, "Shop not found");
    }

    const editableFields = [
      "ownerName",
      "shopName",
      "phone",
      "address",
      "upiId",
      "currency",
      "marketArea",
      "tagline",
      "isOpen"
    ];

    editableFields.forEach((key) => {
      if (req.body?.[key] !== undefined) {
        shop[key] = key === "isOpen" ? Boolean(req.body[key]) : String(req.body[key]).trim();
      }
    });

    if (req.body?.shopName !== undefined) {
      shop.name = String(req.body.shopName).trim();
    }
    if (req.body?.phone !== undefined) {
      shop.ownerPhone = String(req.body.phone).trim();
    }

    await shop.save();
    return res.json({ success: true, shop: publicShop(shop) });
  } catch (err) {
    console.error("Patch shop error:", err);
    return error(res, 500, "Internal server error updating shop");
  }
});

function formatProduct(product) {
  if (!product) return null;
  const obj = typeof product.toObject === "function" ? product.toObject() : { ...product };
  const { _id, __v, ...item } = obj;
  return {
    id: item.id,
    name: item.name,
    price: Number(item.price),
    description: item.description || "",
    inStock: item.inStock !== undefined ? Boolean(item.inStock) : (item.available !== undefined ? Boolean(item.available) : true),
    imageUrl: item.imageUrl || item.image || "",
    imagePreset: item.imagePreset || "",
    category: item.category || "Groceries"
  };
}

app.get("/api/shops/:shopId/products", async (req, res) => {
  try {
    const shop = await resolveShop(req.params.shopId);

    if (!shop) {
      return error(res, 404, "Shop not found");
    }

    const products = await Product.find({
      shopId: Number(shop.id)
    })
      .sort({ id: 1 })
      .lean();

    return res.json(products.map(formatProduct));
  } catch (err) {
    console.error("Get products error:", err);
    return error(
      res,
      500,
      "Internal server error retrieving products"
    );
  }
});

app.post("/api/shops/:shopId/products", async (req, res) => {
  try {
    const rawShopParam = String(req.params.shopId || "").trim();
    const isNumeric = /^\d+$/.test(rawShopParam);
    const shop = await Shop.findOne(
      isNumeric
        ? { $or: [{ id: Number(rawShopParam) }, { shopId: rawShopParam }] }
        : { shopId: rawShopParam }
    );
    const numericShopId = shop ? shop.id : (isNumeric ? Number(rawShopParam) : null);
    if (numericShopId === null) {
      return error(res, 404, "Shop not found");
    }

    const { name, price, description = "", inStock = true, imageUrl = "", imagePreset = "", category = "Groceries" } = req.body || {};
    if (!String(name || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return error(res, 400, "A product name and valid non-negative price are required");
    }

    const lastProduct = await Product.findOne({ shopId: numericShopId }).sort({ id: -1 }).select("id").lean();
    const nextProductId = lastProduct && Number.isFinite(lastProduct.id) ? lastProduct.id + 1 : 1;

    const cleanInStock = inStock !== false;
    const cleanImageUrl = String(imageUrl || "").trim();

    const product = await Product.create({
      id: nextProductId,
      shopId: numericShopId,
      name: String(name).trim(),
      price: Number(price),
      description: String(description).trim(),
      inStock: cleanInStock,
      available: cleanInStock,
      imageUrl: cleanImageUrl,
      image: cleanImageUrl,
      imagePreset: String(imagePreset || "").trim(),
      category: String(category || "Groceries").trim() || "Groceries"
    });

    res.status(201).json({ success: true, product: formatProduct(product) });
  } catch (err) {
    console.error("Create product error:", err);
    return error(res, 500, "Internal server error creating product");
  }
});

app.patch("/api/shops/:shopId/products/:productId", async (req, res) => {
  try {
    const rawShopParam = String(req.params.shopId || "").trim();
    const isNumeric = /^\d+$/.test(rawShopParam);
    const shop = await Shop.findOne(
      isNumeric
        ? { $or: [{ id: Number(rawShopParam) }, { shopId: rawShopParam }] }
        : { shopId: rawShopParam }
    );
    const numericShopId = shop ? shop.id : (isNumeric ? Number(rawShopParam) : null);
    if (numericShopId === null) {
      return error(res, 404, "Shop not found");
    }

    const productId = Number(req.params.productId);
    const product = await Product.findOne({ shopId: numericShopId, id: productId });
    if (!product) {
      return error(res, 404, "Product not found");
    }

    const { name, price, description, inStock, imageUrl, imagePreset, category } = req.body || {};
    if (name !== undefined) product.name = String(name).trim();
    if (price !== undefined) {
      if (!Number.isFinite(Number(price)) || Number(price) < 0) {
        return error(res, 400, "A valid product price is required");
      }
      product.price = Number(price);
    }
    if (description !== undefined) product.description = String(description).trim();
    if (imageUrl !== undefined) {
      product.imageUrl = String(imageUrl).trim();
      product.image = String(imageUrl).trim();
    }
    if (imagePreset !== undefined) product.imagePreset = String(imagePreset).trim();
    if (category !== undefined) product.category = String(category).trim();
    if (inStock !== undefined) {
      product.inStock = Boolean(inStock);
      product.available = Boolean(inStock);
    }

    await product.save();
    return res.json({ success: true, product: formatProduct(product) });
  } catch (err) {
    console.error("Patch product error:", err);
    return error(res, 500, "Internal server error updating product");
  }
});

app.delete("/api/shops/:shopId/products/:productId", async (req, res) => {
  try {
    const rawShopParam = String(req.params.shopId || "").trim();
    const isNumeric = /^\d+$/.test(rawShopParam);
    const shop = await Shop.findOne(
      isNumeric
        ? { $or: [{ id: Number(rawShopParam) }, { shopId: rawShopParam }] }
        : { shopId: rawShopParam }
    );
    const numericShopId = shop ? shop.id : (isNumeric ? Number(rawShopParam) : null);
    if (numericShopId === null) {
      return error(res, 404, "Shop not found");
    }

    const productId = Number(req.params.productId);
    const product = await Product.findOneAndDelete({ shopId: numericShopId, id: productId });
    if (!product) {
      return error(res, 404, "Product not found");
    }

    return res.json({ success: true, deletedProduct: formatProduct(product) });
  } catch (err) {
    console.error("Delete product error:", err);
    return error(res, 500, "Internal server error deleting product");
  }
});

app.get("/api/shops/:shopId/customers", async (req, res) => {
  try {
    const shopId = String(req.params.shopId || "").trim();

    const shop = await Shop.findOne({ shopId }).lean();
    if (!shop) {
      return error(res, 404, "Shop not found");
    }

    const q = String(req.query.q || "").trim().toLowerCase();

    const customers = await Customer.find({ shopId })
      .sort({ id: 1 })
      .lean();

    const filteredCustomers = customers.filter(
      (customer) =>
        !q ||
        `${customer.name} ${customer.phone} ${customer.address}`
          .toLowerCase()
          .includes(q)
    );

    return res.json(
      filteredCustomers.map(({ _id, __v, ...customer }) => customer)
    );
  } catch (err) {
    console.error("Fetch customers error:", err);
    return error(res, 500, "Internal server error retrieving customers");
  }
});

app.post("/api/shops/:shopId/customers", async (req, res) => {
  try {
    const shopId = String(req.params.shopId || "").trim();

    const shop = await Shop.findOne({ shopId }).lean();
    if (!shop) {
      return error(res, 404, "Shop not found");
    }

    const {
      name,
      phone,
      address = ""
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanAddress = String(address || "").trim();

    if (!cleanName || !cleanPhone) {
      return error(
        res,
        400,
        "Customer name and phone are required"
      );
    }

    const existingCustomer = await Customer.findOne({
      shopId,
      phone: cleanPhone
    });

    if (existingCustomer) {
      return error(
        res,
        409,
        "A customer with this phone number already exists"
      );
    }

    const lastCustomer = await Customer.findOne({ shopId })
      .sort({ id: -1 })
      .select("id")
      .lean();

    const nextCustomerId =
      lastCustomer && Number.isFinite(lastCustomer.id)
        ? lastCustomer.id + 1
        : 1;

    const customer = await Customer.create({
      id: nextCustomerId,
      shopId,
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      ordersCount: 0,
      totalSpent: 0
    });

    const customerObject = customer.toObject();
    delete customerObject._id;
    delete customerObject.__v;

    return res.status(201).json({
      success: true,
      customer: customerObject
    });
  } catch (err) {
    console.error("Create customer error:", err);
    return error(
      res,
      500,
      "Internal server error creating customer"
    );
  }
});

app.get("/api/shops/:shopId/orders", async (req, res) => {
  try {
    const shop = await resolveShop(req.params.shopId);

    if (!shop) {
      return error(res, 404, "Shop not found");
    }

    const orders = await Order.find({
      shopId: Number(shop.id)
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(orders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    return error(
      res,
      500,
      "Internal server error retrieving orders"
    );
  }
});

app.post(
  "/api/shops/:shopId/orders",
  async (req, res) => {
    try {
      const shop =
        await resolveShop(
          req.params.shopId
        );

      if (!shop) {
        return error(
          res,
          404,
          "Shop not found"
        );
      }

      const shopId =
        String(shop.shopId).trim();

      const internalShopId =
        Number(shop.id);

      const {
        customerId,
        customerName,
        customerPhone,
        customerAddress,
        items,
        notes = "",
        paymentMethod =
          "Pay on Delivery / UPI",
        status = "received",
        paymentStatus = "pending",
        source = "online"
      } = req.body || {};

      if (
        ![
          customerName,
          customerPhone,
          customerAddress
        ].every(
          (value) =>
            String(value || "")
              .trim()
        )
      ) {
        return error(
          res,
          400,
          "Customer name, phone, and address are required"
        );
      }

      if (
        !Array.isArray(items) ||
        !items.length
      ) {
        return error(
          res,
          400,
          "At least one order item is required"
        );
      }

      const validStatuses = [
        "received",
        "accepted",
        "preparing",
        "ready",
        "completed",
        "cancelled"
      ];

      if (
        !validStatuses.includes(
          status
        )
      ) {
        return error(
          res,
          400,
          "Invalid order status"
        );
      }

      const products =
        await Product.find({
          shopId: internalShopId
        }).lean();

      const orderItems = [];

      for (const item of items) {
        const product =
          products.find(
            (p) =>
              Number(p.id) ===
              Number(item.productId)
          );

        const quantity =
          Number(item.quantity);

        if (
          !product ||
          !Number.isInteger(
            quantity
          ) ||
          quantity <= 0
        ) {
          return error(
            res,
            400,
            "Each order item must contain an available product and positive quantity"
          );
        }

        if (
          product.inStock === false
        ) {
          return error(
            res,
            400,
            `${product.name} is currently unavailable`
          );
        }

        orderItems.push({
          productId:
            product.id,
          name:
            product.name,
          price:
            Number(product.price),
          quantity,
          total:
            Number(product.price) *
            quantity
        });
      }

      const total =
        orderItems.reduce(
          (sum, item) =>
            sum + item.total,
          0
        );

      const lastOrder =
        await Order.findOne({
          shopId:
            internalShopId
        })
          .sort({ id: -1 })
          .select("id")
          .lean();

      const nextOrderId =
        lastOrder &&
        Number.isFinite(
          Number(lastOrder.id)
        )
          ? Number(lastOrder.id) + 1
          : 1001;

      const cleanCustomerName =
        String(
          customerName
        ).trim();

      const cleanCustomerPhone =
        String(
          customerPhone
        ).trim();

      const cleanCustomerAddress =
        String(
          customerAddress
        ).trim();

      const cleanPaymentMethod =
        String(
          paymentMethod
        ).trim();

      const cleanSource =
        String(
          source
        ).trim();

      const isPaid =
        paymentStatus === "paid";

      const order =
        await Order.create({
          id:
            nextOrderId,

          shopId:
            internalShopId,

          customerId:
            customerId
              ? Number(customerId)
              : null,

          customerName:
            cleanCustomerName,

          customerPhone:
            cleanCustomerPhone,

          customerAddress:
            cleanCustomerAddress,

          items:
            orderItems,

          total,

          notes:
            String(notes || "").trim(),

          paymentMethod:
            cleanPaymentMethod,

          paymentStatus:
            isPaid
              ? "paid"
              : "pending",

          status,

          source:
            cleanSource === "manual"
              ? "manual"
              : "online",

          paidAt:
            isPaid
              ? new Date()
              : null,

          completedAt:
            status === "completed"
              ? new Date()
              : null
        });

      let customer = null;

      if (customerId) {
        customer =
          await Customer.findOne({
            shopId,
            id:
              Number(customerId)
          });
      }

      if (!customer) {
        customer =
          await Customer.findOne({
            shopId,
            phone:
              cleanCustomerPhone
          });
      }

      if (!customer) {
        const lastCustomer =
          await Customer.findOne({
            shopId
          })
            .sort({ id: -1 })
            .select("id")
            .lean();

        const nextCustomerId =
          lastCustomer &&
          Number.isFinite(
            Number(lastCustomer.id)
          )
            ? Number(lastCustomer.id) + 1
            : 1;

        customer =
          await Customer.create({
            id:
              nextCustomerId,

            shopId,

            name:
              cleanCustomerName,

            phone:
              cleanCustomerPhone,

            address:
              cleanCustomerAddress,

            ordersCount: 0,

            totalSpent: 0
          });

        order.customerId =
          customer.id;

        await order.save();

      } else {
        customer.name =
          cleanCustomerName;

        customer.address =
          cleanCustomerAddress;

        if (isPaid) {
          customer.totalSpent =
            Number(
              customer.totalSpent || 0
            ) + total;
        }

        customer.ordersCount =
          Number(
            customer.ordersCount || 0
          ) + 1;

        await customer.save();
      }

      if (
        customer.ordersCount === 0
      ) {
        customer.ordersCount = 1;

        if (isPaid) {
          customer.totalSpent =
            Number(
              customer.totalSpent || 0
            ) + total;
        }

        await customer.save();
      }

      return res
        .status(201)
        .json({
          success: true,
          order
        });

    } catch (err) {
      console.error(
        "Create order error:",
        err
      );

      return error(
        res,
        500,
        "Internal server error creating order"
      );
    }
  }
);

app.patch(
  "/api/shops/:shopId/orders/:orderId/status",
  async (req, res) => {
    try {
      const shop = await resolveShop(req.params.shopId);

      if (!shop) {
        return error(res, 404, "Shop not found");
      }

      const shopId = Number(shop.id);
      const orderId = Number(req.params.orderId);

      const validStatuses = [
        "received",
        "accepted",
        "preparing",
        "ready",
        "completed",
        "cancelled"
      ];

      const status = req.body?.status;

      if (!validStatuses.includes(status)) {
        return error(res, 400, "Invalid order status");
      }

      const order = await Order.findOne({
        shopId,
        id: orderId
      });

      if (!order) {
        return error(res, 404, "Order not found");
      }

      order.status = status;

      if (status === "completed") {
        order.completedAt = new Date();
      }

      await order.save();

      return res.json({
        success: true,
        order
      });
    } catch (err) {
      console.error("Update order status error:", err);

      return error(
        res,
        500,
        "Internal server error updating order status"
      );
    }
  }
);

app.post(
  "/api/shops/:shopId/orders/:orderId/cancel",
  async (req, res) => {
    try {
      const shop = await resolveShop(req.params.shopId);

      if (!shop) {
        return error(res, 404, "Shop not found");
      }

      const shopId = Number(shop.id);
      const orderId = Number(req.params.orderId);

      const order = await Order.findOne({
        shopId,
        id: orderId
      });

      if (!order) {
        return error(res, 404, "Order not found");
      }

      const requestedPhone = String(
        req.body?.customerPhone || ""
      )
        .trim()
        .replace(/\s+/g, "");

      const orderPhone = String(
        order.customerPhone || ""
      )
        .trim()
        .replace(/\s+/g, "");

      if (!requestedPhone) {
        return error(
          res,
          400,
          "Customer phone number is required to cancel this order"
        );
      }

      if (!orderPhone || requestedPhone !== orderPhone) {
        return error(
          res,
          403,
          "Customer phone number does not match this order"
        );
      }

      if (order.status === "cancelled") {
        return error(res, 400, "Order is already cancelled");
      }

      if (!["received", "accepted"].includes(order.status)) {
        return error(
          res,
          400,
          `Cannot cancel order with status "${order.status}". Cancellation is only allowed when order status is received or accepted.`
        );
      }

      if (order.paymentStatus === "paid") {
        return error(
          res,
          400,
          "Cannot cancel an order that has already been paid."
        );
      }

      order.status = "cancelled";

      await order.save();

      return res.json({
        success: true,
        order
      });
    } catch (err) {
      console.error("Cancel order error:", err);

      return error(
        res,
        500,
        "Internal server error cancelling order"
      );
    }
  }
);

app.patch(
  "/api/shops/:shopId/orders/:orderId/payment",
  async (req, res) => {
    try {
      const shop = await resolveShop(req.params.shopId);

      if (!shop) {
        return error(res, 404, "Shop not found");
      }

      const shopId = Number(shop.id);
      const orderId = Number(req.params.orderId);

      const order = await Order.findOne({
        shopId,
        id: orderId
      });

      if (!order) {
        return error(res, 404, "Order not found");
      }

      const {
        paymentStatus,
        paymentMethod = "UPI"
      } = req.body || {};

      if (paymentStatus !== "paid") {
        return error(
          res,
          400,
          "Payment status must be paid"
        );
      }

      const wasPaid = order.paymentStatus === "paid";

      order.paymentStatus = "paid";
      order.paymentMethod =
        String(paymentMethod).trim() || "UPI";

      if (!wasPaid) {
        order.paidAt = new Date();
      }

      await order.save();

      // Update customer spending exactly once.
      if (!wasPaid) {
        const customer = order.customerId
          ? await Customer.findOne({
              shopId: shop.shopId,
              id: Number(order.customerId)
            })
          : await Customer.findOne({
              shopId: shop.shopId,
              phone: order.customerPhone
            });

        if (customer) {
          customer.totalSpent =
            Number(customer.totalSpent || 0) +
            Number(order.total || 0);

          await customer.save();
        }
      }

      return res.json({
        success: true,
        order
      });
    } catch (err) {
      console.error("Update payment error:", err);
      return error(
        res,
        500,
        "Internal server error updating payment"
      );
    }
  }
);

app.use(express.static(path.join(__dirname, "..")));

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(
        `SUMUKH server listening at http://localhost:${PORT}`
      );
    });
  } catch (err) {
    console.error(
      "MongoDB connection failed:",
      err.message
    );

    process.exit(1);
  }
}

startServer();
