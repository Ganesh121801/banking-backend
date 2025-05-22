
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const router = express.Router();
const { authenticateToken } = require("../middlewares/jwtmiddleware");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, 
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
);


router.use(authenticateToken);

router.get("/:userId", async (req, res) => {
    const { userId } = req.params;
    
    const { data, error } = await supabase.from("accounts").select("*").eq("user_id", userId);
    if (error) return res.status(400).json({ error: error.message });

    const balance = data.reduce((acc, txn) => 
        acc + (txn.transaction_type === "deposit" ? txn.amount : -txn.amount), 0
    );

    res.json({ transactions: data, balance });
});

router.get("/banker/users", async (req, res) => {
    if (!req.user.isBanker) {
        return res.status(403).json({ error: "Unauthorized. Banker access required." });
    }
    
    const { data, error } = await supabase.from("users").select("*");
    if (error) return res.status(400).json({ error: error.message });
    res.json({ transactions: data });
});

router.post("/deposit", async (req, res) => {
    const { userId, amount } = req.body;
    
    if (req.user.id !== userId && !req.user.isBanker) {
        return res.status(403).json({ error: "Unauthorized transaction attempt" });
    }
    
    const { error } = await supabase.from("accounts").insert([{ user_id: userId, transaction_type: "deposit", amount }]);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Deposit successful" });
});

router.post("/withdraw", async (req, res) => {
    const { userId, amount } = req.body;
    
    // Verify user is withdrawing from their own account or is a banker
    if (req.user.id !== userId && !req.user.isBanker) {
        return res.status(403).json({ error: "Unauthorized transaction attempt" });
    }

    const { data } = await supabase.from("accounts").select("*").eq("user_id", userId);
    
    const balance = data.reduce((acc, txn) => acc + (txn.transaction_type === "deposit" ? txn.amount : -txn.amount), 0);
    
    if (amount > balance) return res.status(400).json({ error: "Insufficient funds" });

    const { error } = await supabase.from("accounts").insert([{ user_id: userId, transaction_type: "withdrawal", amount }]);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Withdrawal successful" });
});

module.exports = router;