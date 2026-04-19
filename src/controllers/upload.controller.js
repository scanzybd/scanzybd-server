import axios from "axios";

function sanitizeApiKey(raw) {
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

function imgbbErrorMessage(payload) {
  if (!payload || typeof payload !== "object") return null;
  const e = payload.error;
  if (typeof e === "string") return e;
  if (e?.message) return typeof e.message === "string" ? e.message : JSON.stringify(e.message);
  return payload.status_txt || null;
}

/**
 * POST body: { image: string } — base64 or full data URL (e.g. from FileReader.readAsDataURL).
 * Forwards to ImgBB v1 and returns the hosted URL for storing on Product, etc.
 */
export const uploadToImgbb = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        success: false,
        message: "Missing `image` (base64 or data URL)",
      });
    }

    const key = sanitizeApiKey(process.env.IMGBB_API_KEY);
    if (!key) {
      return res.status(500).json({
        success: false,
        message: "Server missing IMGBB_API_KEY — add it to server .env and restart",
      });
    }

    let base64 = image.trim();
    if (base64.includes("base64,")) {
      base64 = base64.split("base64,")[1];
    }
    base64 = base64.replace(/\s/g, "");

    // Must encode for x-www-form-urlencoded so '+' / '=' in base64 are not corrupted
    const body = `key=${encodeURIComponent(key)}&image=${encodeURIComponent(base64)}`;

    const { data, status } = await axios.post(
      "https://api.imgbb.com/1/upload",
      body,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        maxBodyLength: 32 * 1024 * 1024,
        maxContentLength: 32 * 1024 * 1024,
        validateStatus: () => true,
      }
    );

    if (status >= 400) {
      const msg =
        imgbbErrorMessage(data) ||
        (typeof data === "string" ? data : null) ||
        `ImgBB HTTP ${status}`;
      console.error("ImgBB HTTP error:", status, data);
      return res.status(502).json({ success: false, message: msg });
    }

    if (!data.success || !data.data?.url) {
      const msg =
        imgbbErrorMessage(data) ||
        "ImgBB did not return an image URL (check API key and image size)";
      console.error("ImgBB logical error:", data);
      return res.status(400).json({ success: false, message: msg });
    }

    return res.status(200).json({
      success: true,
      url: data.data.url,
      displayUrl: data.data.display_url,
      deleteUrl: data.data.delete_url,
    });
  } catch (err) {
    console.error("ImgBB upload error:", err.response?.data || err.message);
    const payload = err.response?.data;
    const msg =
      imgbbErrorMessage(payload) ||
      err.message ||
      "Upload failed";
    return res.status(500).json({ success: false, message: msg });
  }
};
