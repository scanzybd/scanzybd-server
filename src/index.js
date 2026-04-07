// src/index.js


import app from "./app.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

/*
  👉 DB connection আলাদা file এ রাখা হয়েছে
  👉 server start logic clean রাখা হয়েছে
*/

const PORT = process.env.PORT || 5000;

// DB connect
connectDB();

app.get('/', (req, res) => {
    res.send('Abdullah is sitting here. So Enjoy... Your server is running!');
})

// Server start
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});