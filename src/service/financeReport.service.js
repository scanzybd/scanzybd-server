import Order from "../models/Order.js";
import Expense from "../models/Expense.js";
import SettlementRequest from "../models/SettlementRequest.js";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Calendar month range in Bangladesh (Asia/Dhaka). */
export function parseReportPeriod(yearRaw, monthRaw) {
    const year = parseInt(String(yearRaw || ""), 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
        return null;
    }

    const hasMonth =
        monthRaw !== undefined &&
        monthRaw !== null &&
        String(monthRaw).trim() !== "";

    if (hasMonth) {
        const month = parseInt(String(monthRaw), 10);
        if (Number.isNaN(month) || month < 1 || month > 12) {
            return null;
        }
        const mm = String(month).padStart(2, "0");
        const ld = lastDayOfMonth(year, month);
        const from = new Date(`${year}-${mm}-01T00:00:00+06:00`);
        const to = new Date(
            `${year}-${mm}-${String(ld).padStart(2, "0")}T23:59:59.999+06:00`
        );
        return {
            type: "monthly",
            year,
            month,
            from,
            to,
            label: `${MONTH_NAMES[month - 1]} ${year}`,
        };
    }

    const from = new Date(`${year}-01-01T00:00:00+06:00`);
    const to = new Date(`${year}-12-31T23:59:59.999+06:00`);
    return {
        type: "yearly",
        year,
        month: null,
        from,
        to,
        label: String(year),
    };
}

function sumAmount(rows, field = "totalAmount") {
    return rows.reduce((s, r) => s + Number(r[field] || 0), 0);
}

function groupSum(rows, keyField, amountField = "totalAmount") {
    const map = {};
    for (const row of rows) {
        const key = String(row[keyField] || "unknown").trim() || "unknown";
        if (!map[key]) map[key] = { key, total: 0, count: 0 };
        map[key].total += Number(row[amountField] || 0);
        map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
}

function monthMetaFromDate(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Dhaka",
        month: "numeric",
        year: "numeric",
    }).formatToParts(new Date(date));
    const month = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
    const year = parseInt(parts.find((p) => p.type === "year")?.value || "2000", 10);
    return {
        month,
        year,
        monthLabel: MONTH_NAMES[month - 1],
    };
}

function mapOrderRow(o) {
    const meta = monthMetaFromDate(o.createdAt);
    return {
        _id: o._id,
        orderNo: o.orderNo,
        orderKind: o.orderKind || "purchase",
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod || "",
        paymentStatus: o.paymentStatus || "",
        status: o.status,
        createdAt: o.createdAt,
        month: meta.month,
        monthLabel: meta.monthLabel,
        providerName: o.createdBy?.name || "",
        providerEmail: o.createdBy?.email || "",
    };
}

async function fetchPeriodData(from, to) {
    const [paidOrders, allOrders, expenses, settlements] = await Promise.all([
        Order.find({
            paymentStatus: "paid",
            createdAt: { $gte: from, $lte: to },
        })
            .select(
                "orderNo orderKind totalAmount status paymentStatus paymentMethod createdAt userId createdBy"
            )
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .lean(),
        Order.find({ createdAt: { $gte: from, $lte: to } })
            .select(
                "orderNo orderKind totalAmount status paymentStatus paymentMethod createdAt userId createdBy"
            )
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .lean(),
        Expense.find({ createdAt: { $gte: from, $lte: to } })
            .sort({ createdAt: -1 })
            .lean(),
        SettlementRequest.find({
            status: "accepted",
            reviewedAt: { $gte: from, $lte: to },
        })
            .populate("providerId", "name email")
            .sort({ reviewedAt: -1 })
            .lean(),
    ]);
    return { paidOrders, allOrders, expenses, settlements };
}

function sortOrdersDesc(rows) {
    return [...rows].sort(
        (a, c) => new Date(c.createdAt) - new Date(a.createdAt)
    );
}

/** All orders grouped by calendar month (Asia/Dhaka). */
function buildMonthlyOrders(allOrders, year) {
    const byMonth = {};
    for (let m = 1; m <= 12; m += 1) {
        byMonth[m] = {
            month: m,
            label: MONTH_NAMES[m - 1],
            year,
            orderCount: 0,
            paidCount: 0,
            totalSales: 0,
            totalAmount: 0,
            orders: [],
        };
    }

    for (const o of allOrders) {
        const meta = monthMetaFromDate(o.createdAt);
        if (meta.year !== year) continue;
        const row = mapOrderRow(o);
        const bucket = byMonth[meta.month];
        if (!bucket) continue;
        bucket.orders.push(row);
        bucket.orderCount += 1;
        bucket.totalAmount += Number(o.totalAmount || 0);
        if (String(o.paymentStatus) === "paid") {
            bucket.paidCount += 1;
            bucket.totalSales += Number(o.totalAmount || 0);
        }
    }

    return Object.values(byMonth).map((b) => ({
        ...b,
        orders: sortOrdersDesc(b.orders),
    }));
}

function buildSingleMonthOrdersBlock(period, allOrders, paidOrders, totalSales) {
    return [
        {
            month: period.month,
            label: period.label,
            year: period.year,
            orderCount: allOrders.length,
            paidCount: paidOrders.length,
            totalSales,
            totalAmount: sumAmount(allOrders, "totalAmount"),
            orders: sortOrdersDesc(allOrders.map(mapOrderRow)),
        },
    ];
}

function buildSummary(orders, expenses, settlements) {
    const totalIncome = sumAmount(orders, "totalAmount");
    const totalExpenses = sumAmount(expenses, "amount");
    const settlementsPaid = sumAmount(settlements, "amount");
    return {
        totalIncome,
        totalExpenses,
        settlementsPaid,
        netProfit: totalIncome - totalExpenses,
        orderCount: orders.length,
        expenseCount: expenses.length,
        settlementCount: settlements.length,
    };
}

async function buildMonthlyBreakdown(year) {
    const rows = [];
    for (let month = 1; month <= 12; month += 1) {
        const period = parseReportPeriod(year, month);
        const { paidOrders, allOrders, expenses, settlements } = await fetchPeriodData(
            period.from,
            period.to
        );
        const summary = buildSummary(paidOrders, expenses, settlements);
        rows.push({
            month,
            label: MONTH_NAMES[month - 1],
            totalSales: summary.totalIncome,
            allOrderCount: allOrders.length,
            ...summary,
        });
    }
    return rows;
}

export async function buildAdminFinanceReport(yearRaw, monthRaw) {
    const period = parseReportPeriod(yearRaw, monthRaw);
    if (!period) {
        throw new Error("Invalid year or month");
    }

    const { paidOrders, allOrders, expenses, settlements } = await fetchPeriodData(
        period.from,
        period.to
    );

    const summary = buildSummary(paidOrders, expenses, settlements);
    summary.allOrderCount = allOrders.length;

    const report = {
        period: {
            type: period.type,
            year: period.year,
            month: period.month,
            label: period.label,
            from: period.from.toISOString(),
            to: period.to.toISOString(),
        },
        summary,
        incomeByKind: groupSum(
            paidOrders.map((o) => ({ ...o, orderKind: o.orderKind || "purchase" })),
            "orderKind"
        ),
        incomeByPaymentMethod: groupSum(paidOrders, "paymentMethod"),
        expensesByCategory: groupSum(expenses, "category", "amount"),
        orders: paidOrders.map(mapOrderRow),
        allOrders: allOrders.map(mapOrderRow),
        monthlyOrders:
            period.type === "yearly"
                ? buildMonthlyOrders(allOrders, period.year)
                : buildSingleMonthOrdersBlock(
                      period,
                      allOrders,
                      paidOrders,
                      summary.totalIncome
                  ),
        expenses: expenses.map((e) => ({
            _id: e._id,
            title: e.title,
            amount: e.amount,
            category: e.category,
            note: e.note,
            createdBy: e.createdBy,
            createdAt: e.createdAt,
        })),
        settlements: settlements.map((s) => ({
            _id: s._id,
            providerName: s.providerId?.name || "",
            providerEmail: s.providerId?.email || "",
            periodFrom: s.periodFrom,
            periodTo: s.periodTo,
            amount: s.amount,
            orderCount: s.orderCount,
            reviewedAt: s.reviewedAt,
        })),
    };

    if (period.type === "yearly") {
        report.monthlyBreakdown = await buildMonthlyBreakdown(period.year);
    }

    return report;
}
