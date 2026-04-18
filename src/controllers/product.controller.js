import Product from "../models/Product.js";

// ➕ Add Product
export const addProduct = async (req, res) => {
    try {
        const product = req.body;

        const result = await Product.create({
            ...product,
            createdAt: new Date(),
        });

        res.status(201).send({
            success: true,
            message: "Product created successfully",
            data: result,
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            success: false,
            message: "Failed to add product",
            error: error.message,
        });
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

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.status(200).json({
            success: true,
            data: product,
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch product",
        });
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