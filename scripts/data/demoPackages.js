/** Demo homepage offers — inserted by scripts/seed-demo-packages.mjs */

export const DEMO_PACKAGES = [
    {
        title: "Starter Pack",
        price: 2999,
        currency: "BDT",
        description:
            "Perfect for small garages and individual vehicle owners starting with QR tags.",
        category: "starter",
        highlight: false,
        features: [
            "10 QR Sampark Tags",
            "Basic vehicle profile",
            "Email support",
            "60-day money-back guarantee",
        ],
        createdBy: {
            name: "ScanzyBD Demo",
            email: "demo@scanzybd.com",
            uid: "demo-seed",
        },
    },
    {
        title: "Growth Pack",
        price: 6999,
        currency: "BDT",
        description:
            "For growing service centers that need more tags and priority support.",
        category: "standard",
        highlight: true,
        features: [
            "30 QR Tags",
            "Staff-friendly dashboard access",
            "Priority email support",
            "Marketing starter kit",
            "Customer contact privacy controls",
        ],
        createdBy: {
            name: "ScanzyBD Demo",
            email: "demo@scanzybd.com",
            uid: "demo-seed",
        },
    },
    {
        title: "Business Partner Pack",
        price: 12999,
        currency: "BDT",
        description:
            "For multi-branch businesses and partners managing many vehicles.",
        category: "premium",
        highlight: false,
        features: [
            "75+ QR Tags",
            "Provider finance tools",
            "Dedicated onboarding support",
            "Bulk assignment workflow",
            "Renewal reminders for customers",
        ],
        createdBy: {
            name: "ScanzyBD Demo",
            email: "demo@scanzybd.com",
            uid: "demo-seed",
        },
    },
];
