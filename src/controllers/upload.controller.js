import { v2 as cloudinary } from "cloudinary";
import { compressProductImage } from "../utils/compressProductImage.js";

function sanitizeEnv(raw) {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  return k.replace(/\r|\n/g, "").trim();
}

function configureCloudinary() {
  const cloud_name = sanitizeEnv(process.env.CLOUDINARY_CLOUD_NAME);
  const api_key = sanitizeEnv(process.env.CLOUDINARY_API_KEY);
  const api_secret = sanitizeEnv(process.env.CLOUDINARY_API_SECRET);

  if (!cloud_name || !api_key || !api_secret) {
    return null;
  }

  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true,
  });

  return cloudinary;
}

/**
 * POST body: { image: string } — base64 or full data URL (e.g. from FileReader.readAsDataURL).
 * Uploads to Cloudinary and returns the hosted HTTPS URL for Product / settings images.
 */
export const uploadToCloudinary = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        success: false,
        message: "Missing `image` (base64 or data URL)",
      });
    }

    const cld = configureCloudinary();
    if (!cld) {
      return res.status(500).json({
        success: false,
        message:
          "Server missing Cloudinary config — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server .env and restart",
      });
    }

    let base64 = image.trim();
    let mime = "image/jpeg";
    const dataUrlMatch = /^data:([^;]+);base64,/i.exec(base64);
    if (dataUrlMatch) {
      mime = dataUrlMatch[1] || mime;
      base64 = base64.slice(dataUrlMatch[0].length);
    } else if (base64.includes("base64,")) {
      base64 = base64.split("base64,")[1];
    }
    base64 = base64.replace(/\s/g, "");

    let uploadBuffer;
    try {
      const rawBuffer = Buffer.from(base64, "base64");
      uploadBuffer = await compressProductImage(rawBuffer);
      mime = "image/jpeg";
    } catch (compressErr) {
      console.warn(
        "Product image compression skipped, uploading original:",
        compressErr.message
      );
      uploadBuffer = Buffer.from(base64, "base64");
    }

    const dataUri = `data:${mime};base64,${uploadBuffer.toString("base64")}`;
    const folder = sanitizeEnv(process.env.CLOUDINARY_UPLOAD_FOLDER) || "scanzybd";

    const result = await cld.uploader.upload(dataUri, {
      folder,
      resource_type: "image",
      overwrite: false,
    });

    const url = result.secure_url || result.url;
    if (!url) {
      return res.status(502).json({
        success: false,
        message: "Cloudinary did not return an image URL",
      });
    }

    return res.status(200).json({
      success: true,
      url,
      displayUrl: url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err?.message || err);
    const msg =
      err?.error?.message ||
      err?.message ||
      "Upload failed";
    return res.status(500).json({ success: false, message: msg });
  }
};

/** @deprecated Use uploadToCloudinary — kept so old /imgbb clients keep working */
export const uploadToImgbb = uploadToCloudinary;
