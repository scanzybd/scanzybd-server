import axios from "axios";

export const grantBkashToken = async () => {
    try {
        const res = await axios.post(
            process.env.BKASH_GRANT_TOKEN_URL,
            {
                app_key: process.env.BKASH_APP_KEY,
                app_secret: process.env.BKASH_APP_SECRET,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    username: process.env.BKASH_USERNAME,
                    password: process.env.BKASH_PASSWORD,
                },
            }
        );

        console.log("BKASH TOKEN OK");
        return res.data.id_token;
    } catch (error) {
        console.log("TOKEN ERROR:", error.response?.data || error.message);
        throw error;
    }
};