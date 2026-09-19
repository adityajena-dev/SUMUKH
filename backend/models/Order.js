const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: Number,
      required: true
    },

    name: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

total: {
  type: Number,
  required: true,
  min: 0
}
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true
    },

    shopId: {
      type: Number,
      required: true
    },

    customerId: {
      type: Number,
      default: null
    },

    customerName: {
      type: String,
      default: ""
    },

    customerPhone: {
      type: String,
      default: ""
    },

    customerAddress: {
      type: String,
      default: ""
    },

    items: {
      type: [orderItemSchema],
      required: true
    },

    total: {
      type: Number,
      required: true,
      min: 0
    },

    paymentMethod: {
      type: String,
      default: "UPI"
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending"
    },

    status: {
      type: String,
      enum: ["received", "accepted", "preparing", "ready", "completed", "cancelled"],
      default: "received"
    },

    source: {
      type: String,
      enum: ["online", "manual"],
      default: "online"
    },

    paidAt: {
      type: Date,
      default: null
    },

    notes: {
      type: String,
      default: ""
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Order", orderSchema);