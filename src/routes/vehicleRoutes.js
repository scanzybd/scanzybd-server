import express from "express";
import {
    addVehicle,
    getVehicles,
    getMyVehicles,
    deleteVehicle,
    updateVehicle,
} from "../controllers/vehicle.controller.js";

const router = express.Router();
import { verifyToken } from "../middleware/auth.js";

router.post("/add", verifyToken, addVehicle);
router.get("/", verifyToken, getVehicles);
router.get("/my", verifyToken, getMyVehicles);
router.post("/update/:id", verifyToken, updateVehicle);
router.delete("/delete/:id", verifyToken, deleteVehicle);

export default router;