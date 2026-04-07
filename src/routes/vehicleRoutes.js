import express from "express";
import {
    addVehicle,
    getVehicles,
    getMyVehicles,
    deleteVehicle,
    updateVehicle,
} from "../controllers/vehicle.controller.js";

const router = express.Router();
import { isProvider, verifyToken } from "../middleware/auth.js";

router.post("/add", verifyToken, addVehicle);
router.get("/", verifyToken, getVehicles);
router.get("/my", verifyToken, getMyVehicles);
router.put("/update/:id", verifyToken, updateVehicle);
router.delete("/delete/:id", verifyToken, isProvider, deleteVehicle);

export default router;