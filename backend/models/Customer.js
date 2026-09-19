const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true
    },

    shopId: {
      type: String,
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    address: {
      type: String,
      default: "",
      trim: true
    },

    ordersCount: {
      type: Number,
      default: 0
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Customer", customerSchema);