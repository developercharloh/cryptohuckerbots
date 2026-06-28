import { Router } from "express";
import { db, usersTable, sessionsTable, referralsTable, transactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  return users[0] ?? null;
}

router.get("/team/referral", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, user.id));
  const totalEarnings = referrals.reduce((sum, r) => sum + parseFloat(r.earnings), 0);
  const baseUrl = `https://vixus.ai`;

  return res.json({
    referralCode: user.referralCode,
    referralLink: `${baseUrl}/?ref=${user.referralCode}`,
    totalReferrals: referrals.length,
    totalEarnings,
  });
});

router.get("/team/members", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const referrals = await db.select({
    referral: referralsTable,
    referred: usersTable,
  }).from(referralsTable)
    .innerJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, user.id));

  return res.json(referrals.map(({ referral, referred }) => ({
    id: referred.id,
    fullName: referred.fullName,
    email: referred.email,
    joinedAt: referred.createdAt.toISOString(),
    earnings: parseFloat(referral.earnings),
    status: "active",
  })));
});

router.get("/team/earnings-overview", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const period = (req.query.period as string) || "this_month";
  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, user.id));
  const totalEarnings = referrals.reduce((sum, r) => sum + parseFloat(r.earnings), 0);

  // Generate chart
  const days = 30;
  const chart = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    chart.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(Math.random() * 50 * 100) / 100,
    });
  }

  return res.json({ period, totalEarnings, chart });
});

export default router;
