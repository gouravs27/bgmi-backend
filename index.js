const express = require("express");
const connectDB = require("./src/config/db");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const User = require("./src/models/user");
const MatchStats = require("./src/models/matchStats")
const {authMiddleware, isAdmin} = require("./src/middleware/authMiddleware")

require("dotenv").config();
const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.get("/", (req, res) => {
    res.send("BGMI Backend Running 🚀");
});

app.post("/signup", async (req, res) => {
    try {
        let { userId, playerName } = req.body;

        // ✅ basic validation
        if (!userId || !playerName) {
            return res.status(400).json({ message: "All fields required" });
        }

        // ✅ normalize data
        userId = userId.toLowerCase();
        playerName = playerName.trim();

        const existingUser = await User.findOne({ userId });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const user = new User({
            userId,
            playerName,
            isAdmin: false,
        });

        await user.save();

        res.status(201).json({
            message: "User created successfully",
            user,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/login", async (req, res) => {
    try {
        let { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        userId = userId.toLowerCase();

        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const token = jwt.sign(
            { userId: user.userId, isAdmin: user.isAdmin },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
        });

        // ✅ If admin → fetch all users
        let allUsers = [];
        if (user.isAdmin) {
            const users = await User.find({}, "userId name"); // only required fields
            allUsers = users;
        }

        res.json({
            message: "Login successful",
            user,
            allUsers, // ✅ only filled for admin
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/addstats", authMiddleware, isAdmin, async (req, res) => {
    try {
        const {
            playerId,
            playerName,
            map,
            team1,
            team2,
            team3,
            team4,
            kills,
            damage,
            damageTaken,
            mvp,
            matchResult,
        } = req.body;

        if (!playerId || !playerName || !map) {
            return res.status(400).json({ message: "Required fields missing" });
        }

        const stats = new MatchStats({
            playerId,
            playerName,
            map,
            team1,
            team2,
            team3,
            team4,
            kills,
            damage,
            damageTaken,
            mvp,
            matchResult,
        });

        await stats.save();

        res.status(201).json({
            message: "Stats added successfully",
            stats,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/profile", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // ✅ get user info
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ aggregate stats
        const stats = await MatchStats.aggregate([
            {
                $match: { playerId: userId },
            },
            {
                $group: {
                    _id: "$playerId",
                    totalKills: { $sum: "$kills" },
                    totalDamage: { $sum: "$damage" },
                    totalDamageTaken: { $sum: "$damageTaken" },
                    totalMatches: { $sum: 1 },
                    totalMVP: {
                        $sum: {
                            $cond: [{ $eq: ["$mvp", "Yes"] }, 1, 0],
                        },
                    },
                    totalWins: {
                        $sum: {
                            $cond: [{ $eq: ["$matchResult", "Won"] }, 1, 0],
                        },
                    },
                },
            },
        ]);

        const result = stats[0] || {
            totalKills: 0,
            totalDamage: 0,
            totalDamageTaken: 0,
            totalMatches: 0,
            totalMVP: 0,
            totalWins: 0,
        };

        res.json({
            userId: user.userId,
            playerName: user.playerName,
            stats: result,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/matches", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId; // from JWT

        const matches = await MatchStats.find({ playerId: userId })
            .sort({ createdAt: -1 }); // latest first

        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/last-matches-kills", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const matches = await MatchStats.find({ playerId: userId })
            .sort({ createdAt: -1 })
            .limit(10);

        const formatted = matches
            .reverse()
            .map((match, index) => ({
                match: `Match ${index + 1}`,
                kills: match.kills,
            }));

        res.json({
            total: formatted.length, // ✅ number of matches returned
            data: formatted,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/last-matches-damage", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const matches = await MatchStats.find({ playerId: userId })
            .sort({ createdAt: -1 })
            .limit(10);

        const formatted = matches
            .reverse()
            .map((match, index) => ({
                match: `Match ${index + 1}`,
                damage: match.damage,
            }));

        res.json({
            total: formatted.length,
            data: formatted,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/leaderboard", async (req, res) => {
    try {
        const stats = await MatchStats.aggregate([
            {
                $group: {
                    _id: "$playerId",
                    playerName: { $first: "$playerName" },

                    totalKills: { $sum: "$kills" },
                    totalDamage: { $sum: "$damage" },
                    totalDamageTaken: { $sum: "$damageTaken" },

                    totalMatches: { $sum: 1 },

                    bestKill: { $max: "$kills" }, // ✅ best kill in single match

                    totalWins: {
                        $sum: {
                            $cond: [{ $eq: ["$matchResult", "Won"] }, 1, 0],
                        },
                    },
                },
            },
        ]);

        // 🏆 Categories
        const topWins = [...stats].sort((a, b) => b.totalWins - a.totalWins)[0];
        const topKills = [...stats].sort((a, b) => b.totalKills - a.totalKills)[0];
        const topDamage = [...stats].sort((a, b) => b.totalDamage - a.totalDamage)[0];

        const leastDamageTaken = [...stats].sort(
            (a, b) => a.totalDamageTaken - b.totalDamageTaken
        )[0];

        const mostMatches = [...stats].sort(
            (a, b) => b.totalMatches - a.totalMatches
        )[0];

        const bestKillPlayer = [...stats].sort(
            (a, b) => b.bestKill - a.bestKill
        )[0];

        res.json({
            topWins,
            topKills,
            topDamage,
            leastDamageTaken,
            mostMatches,
            bestKillPlayer,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
connectDB()
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log(`Server running on PORT ${process.env.PORT}!`);
        });
    })
    .catch((err) => {
        console.log(`Server Error: ${err.message}`);
    });