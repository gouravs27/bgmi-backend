const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    await mongoose.connect(
        process.env.MONGO_DB_URL,
    );
    console.log("MONGO DB is Connected!")
};

module.exports = connectDB;