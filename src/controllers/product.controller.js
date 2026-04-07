import Product from "../models/Product.js";

// ➕ Add Product
export const addProduct = async (req, res) => {
    try {
        const product = req.body;

        const result = await Product.create({
            ...product,
            createdAt: new Date(),
        });

        res.send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to add product" });
    }
};

// 👤 My Products
export const myProducts = async (req, res) => {
    try {
        const email = req.params.email;

        const result = await Product.find({
            "createdBy.email": email,
        });

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to get products" });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const result = await Product.find();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to get products" });
    }
};