const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            required: true
        },

        priority: {
            type: String,
            required: true,
            enum: ["Low", "Medium", "High"]
        },

        location: {
            type: String,
            required: true
        },

        title: {
            type: String,
            required: true
        },

        description: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "In Progress", "Resolved"],
            default: "Pending"
        },

        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Problem", problemSchema);