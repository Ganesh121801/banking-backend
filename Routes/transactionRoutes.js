const express = require("express");
const { PrismaClient } = require("@prisma/client");
const router = express.Router();
const { authenticateToken } = require("../middlewares/jwtmiddleware");

const prisma = new PrismaClient();

router.use(authenticateToken);

// Get user transactions
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { account: true }
    });

    const account = await prisma.account.findFirst({
      where: { userId }
    });

    res.json({ 
      transactions,
      balance: account?.balance || 0
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all users (banker only)
router.get("/banker/users", async (req, res) => {
  if (!req.user.isBanker) {
    return res.status(403).json({ error: "Unauthorized. Banker access required." });
  }
  
  try {
    const users = await prisma.user.findMany({
      include: {
        accounts: true
      }
    });
    res.json({ transactions: users });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Handle deposit
router.post("/deposit", async (req, res) => {
  const { userId, amount } = req.body;
  
  if (req.user.id !== userId && !req.user.isBanker) {
    return res.status(403).json({ error: "Unauthorized transaction attempt" });
  }

  try {
    const result = await prisma.$transaction(async (prisma) => {
      const account = await prisma.account.findFirst({
        where: { userId }
      });

      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } }
      });

      const transaction = await prisma.transaction.create({
        data: {
          amount,
          transactionType: "deposit",
          userId,
          accountId: account.id
        }
      });

      return { account: updatedAccount, transaction };
    });

    res.json({ message: "Deposit successful", data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Handle withdrawal
router.post("/withdraw", async (req, res) => {
  const { userId, amount } = req.body;
  
  if (req.user.id !== userId && !req.user.isBanker) {
    return res.status(403).json({ error: "Unauthorized transaction attempt" });
  }

  try {
    const result = await prisma.$transaction(async (prisma) => {
      const account = await prisma.account.findFirst({
        where: { userId }
      });

      if (account.balance < amount) {
        throw new Error("Insufficient funds");
      }

      const updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: { balance: { decrement: amount } }
      });

      const transaction = await prisma.transaction.create({
        data: {
          amount,
          transactionType: "withdrawal",
          userId,
          accountId: account.id
        }
      });

      return { account: updatedAccount, transaction };
    });

    res.json({ message: "Withdrawal successful", data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;