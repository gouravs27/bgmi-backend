const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true, // unique player ID
            trim: true,
        },
        playerName: {
            type: String,
            required: true,
            trim: true,
        },
        isAdmin: {
            type: Boolean,
            default: false, // true or false
        },
    },
    {
        timestamps: true, // adds createdAt & updatedAt
    }
);

module.exports = mongoose.model("User", userSchema);