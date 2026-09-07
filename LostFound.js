const mongoose = require("mongoose");

const lostFoundSchema = new mongoose.Schema(
    {
        reportType: {
            type: String,
            enum: ["Lost", "Found"],
            required: true
        },

        category: {
            type: String,
            required: true
        },

        itemName: {
            type: String,
            required: true,
            trim: true
        },

        location: {
            type: String,
            required: true,
            trim: true
        },

        date: {
            type: Date,
            required: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        status: {
            type: String,
            enum: ["Active", "Matched", "Resolved"],
            default: "Active"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("LostFound", lostFoundSchema);