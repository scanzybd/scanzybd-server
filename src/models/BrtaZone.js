import mongoose from "mongoose";

const brtaZoneSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "BRTA_zone" }
);

export default mongoose.model("BrtaZone", brtaZoneSchema);
