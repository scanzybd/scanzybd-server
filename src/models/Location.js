import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({}, { strict: false, collection: "locations" });

export default mongoose.model("Location", locationSchema);
