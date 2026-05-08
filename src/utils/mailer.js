import nodemailer from "nodemailer";

function getSmtpConfig() {
    const smtpService = process.env.SMTP_SERVICE?.trim();

    const smtpHost = process.env.SMTP_HOST?.trim();

    const smtpPort = Number(
        process.env.SMTP_PORT || 587
    );

    const smtpUser = process.env.SMTP_USER?.trim();

    const smtpPass = process.env.SMTP_PASS?.trim();

    const smtpFrom =
        process.env.SMTP_FROM?.trim() || smtpUser;

    const smtpSecure =
        String(process.env.SMTP_SECURE || "")
            .toLowerCase() === "true" ||
        smtpPort === 465;

    if (!smtpUser || !smtpPass || !smtpFrom) {
        console.error("❌ Missing SMTP credentials");

        return null;
    }

    if (!smtpService && !smtpHost) {
        console.error("❌ Missing SMTP host/service");

        return null;
    }

    return {
        smtpService,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
        smtpSecure,
    };
}

export async function sendResetCodeEmail({
    toEmail,
    code,
    expiresMinutes = 10,
}) {
    try {
        const cfg = getSmtpConfig();

        if (!cfg) {
            return false;
        }

        const transport = cfg.smtpService
            ? nodemailer.createTransport({
                service: cfg.smtpService,

                auth: {
                    user: cfg.smtpUser,
                    pass: cfg.smtpPass,
                },

                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 10000,

                tls: {
                    rejectUnauthorized: false,
                },
            })
            : nodemailer.createTransport({
                host: cfg.smtpHost,
                port: cfg.smtpPort,
                secure: cfg.smtpSecure,

                auth: {
                    user: cfg.smtpUser,
                    pass: cfg.smtpPass,
                },

                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 10000,

                tls: {
                    rejectUnauthorized: false,
                },
            });

        // Verify SMTP connection
        await transport.verify();

        console.log("✅ SMTP Connected");

        const subject = "Your password reset code";

        const text = `
Your reset code is ${code}.

This code expires in ${expiresMinutes} minutes.
`;

        const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>Password Reset Code</h2>

        <p>Your reset code is:</p>

        <p
          style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 6px;
          "
        >
          ${code}
        </p>

        <p>
          This code expires in
          ${expiresMinutes} minutes.
        </p>
      </div>
    `;

        const info = await transport.sendMail({
            from: cfg.smtpFrom,
            to: toEmail,
            subject,
            text,
            html,
        });

        console.log(
            "✅ Reset Email Sent:",
            info.messageId
        );

        return true;
    } catch (err) {
        console.error("❌ Email Send Error:", err);

        return false;
    }
    console.log("Accepted:", info.accepted);

    console.log("Rejected:", info.rejected);

    console.log("Response:", info.response);
}