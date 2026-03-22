const mongoose = require("mongoose");

const matchStatsSchema = new mongoose.Schema(
    {
        playerId: {
            type: String,
            required: true,
        },
        playerName: {
            type: String,
            required: true,
        },
        map: {
            type: String,
            enum: ["Erangel", "Miramar", "Livik"],
            required: true,
        },
        team1: String,
        team2: String,
        team3: String,
        team4: String,

        kills: {
            type: Number,
            default: 0,
        },
        damage: {
            type: Number,
            default: 0,
        },
        damageTaken: {
            type: Number,
            default: 0,
        },

        mvp: {
            type: String,
            enum: ["Yes", "No"],
            default: "No",
        },

        matchResult: {
            type: String,
            enum: ["Won", "Lost"],
            default: "Won",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("MatchStats", matchStatsSchema);