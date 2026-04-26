import express from "express";
import bodyParser from "body-parser";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.raw({ type: "application/json" }));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (email) {
      await supabase.from("users").upsert({
        email,
        status: "active",
        plan: "monthly"
      });

      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `🔥 NEW USER: ${email}`
        })
      });
    }
  }

  res.sendStatus(200);
});

app.get("/", (_, res) => res.send("OK"));

app.listen(3000);
