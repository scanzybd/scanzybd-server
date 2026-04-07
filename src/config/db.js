import mongoose from "mongoose";

/*
  👉 Build Mongo URI from env variables
  👉 More secure + reusable
*/

export const connectDB = async () => {

    try {
        const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mh16alw.mongodb.net/qrTag?retryWrites=true&w=majority&appName=Cluster0`;

        await mongoose.connect(uri);

        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.log("❌ DB Error:", err.message);
        process.exit(1);
    }
};


