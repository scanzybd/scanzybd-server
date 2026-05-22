import mongoose from "mongoose";

const brtaSeriesSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "BRTA_series" }
);

export default mongoose.model("BrtaSeries", brtaSeriesSchema);
