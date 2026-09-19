const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      default: ""
    },

    address: {
      type: String,
      default: ""
    },

    ownerName: {
      type: String,
      default: ""
    },

    ownerPhone: {
      type: String,
      default: ""
    },

    username: {
      type: String,
      required: true,
      unique: true
    },

    shopId: {
      type: String,
      default: "",
      trim: true
    },

    shopName: {
      type: String,
      default: "",
      trim: true
    },

    email: {
      type: String,
      default: "",
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    upiId: {
      type: String,
      default: "",
      trim: true
    },

    currency: {
      type: String,
      default: "₹"
    },

    isOpen: {
      type: Boolean,
      default: true
    },

    marketArea: {
      type: String,
      default: "",
      trim: true
    },

    tagline: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Shop", shopSchema);