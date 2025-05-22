const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const router = express.Router();
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



router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    console.log(name,email,password);
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await supabase.auth.getUser();
    // Insert into Supabase
    const { data, error } = await supabase
    .from("users")
    .insert([{ name, email, password: hashedPassword, role:"customer" }])
    .select("id, name, email, role");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "User registered successfully", user: data });
});


// In your auth route file
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
  
      const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

          console.log(data);
          
      if (error || !data) {
          return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, data.password);
      if (!validPassword) {
          return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
          { 
              id: data.id, 
              email: data.email,
              isBanker: data.role === 'banker' 
          }, 
          process.env.JWT_SECRET, 
          { expiresIn: '24h' }
      );
      
      res.json({ token, user: { id: data.id, email: data.email, role: data.role,isAdmin:data.role === 'banker' } });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});
module.exports = router;
