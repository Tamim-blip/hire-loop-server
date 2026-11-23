import express from "express"
import cors from "cors"
import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb';
import { Stripe } from "stripe"


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)


const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(cors())

const client = new MongoClient(process.env.BETTER_AUTH_DB_URI);


export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedDB = await connectToMongoDB()
const db = connectedDB.db('hire-loop-app')
const users = db.collection("user")
const jobs = db.collection("jobs")
const application = db.collection("application")
const payment = db.collection("payments")

app.get("/", (req, res) => {
    res.send("Hello world")
})


app.get("/users", async (req, res) => {
    const result = await users.find().toArray()
    res.send(result)
})

app.post("/jobs", async (req, res) => {

    const jobData = req.body

    const result = await jobs.insertOne(jobData)
    res.send(result)
})



app.get("/jobs", async (req, res) => {
  const query = {};

  // Filter by job type
  if (req.query.jobType) {
    query.jobType = req.query.jobType;
  }else if (req.query.category) {
    query.category = req.query.category;
  }

  // Filter by remote status
  

  // Search across multiple fields
  if (req.query.search) {
    query.$or = [
      { title: { $regex: req.query.search, $options: "i" } },
      { category: { $regex: req.query.search, $options: "i" } },
      { location: { $regex: req.query.search, $options: "i" } },
      { responsibilities: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const result = await jobs.find(query).toArray();

  res.send(result);
});


app.get("/recuritor-jobs", async(req, res) => {

  const query = {}
  if(req.query.recruiterId){
    query.recruiterId = req.query.recruiterId
  }

  const result = await jobs.find(query).toArray()
  res.send(result)
})


app.get("/recuritor-jobs/count", async(req, res) => {

  const query = {}

  if(req.query.recruiterId){
    query.recruiterId = req.query.recruiterId
  }

  const result = await jobs.countDocuments(query)
  res.send({count : result})
})


app.get("/jobs/:id", async (req, res) => {

    const id = req.params.id

   const result = await jobs.findOne({_id : new ObjectId(id)})
    res.send(result)
})


app.patch("/jobs/:id", async (req, res) => {
  const { id } = req.params;

  const updatedJob = req.body;

  const result = await jobs.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedJob }
  );

  res.send(result);
});


app.delete("/jobs/:id", async (req, res) => {

    const id = req.params.id
    const result = await jobs.deleteOne({_id : new ObjectId(id)})
    res.send(result)
})



app.post("/applications", async(req, res) => {
  const data = req.body

  const result = await application.insertOne(data)
  res.send(result)
})


app.get("/applications", async (req, res) => {

  const query = {}

  if(req.query.userId){
    query.userId = req.query.userId
  }

  const cursor = application.find(query)
  const result = await cursor.toArray()
  res.send(result)
})



app.get("/applications/count", async (req, res) => {

  const query = {}

  if(req.query.userId){
    query.userId = req.query.userId
  }

  const result = await application.countDocuments(query)
  res.send({count: result})
})



// payment api

app.post("/payment/checkout-verify", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).send({
        success: false,
        message: "Session ID is required",
      });
    }

    const session =
      await stripe.checkout.sessions.retrieve(sessionId);

    const {
      id,
      status,
      amount_total,
      customer_email,
      metadata,
      payment_status,
      payment_intent,
    } = session;

    if (status !== "complete" || payment_status !== "paid") {
      return res.send({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Check if payment already exists
    const existingPayment = await payment.findOne({
      sessionId: id,
    });

    if (existingPayment) {
      return res.send({
        success: true,
        alreadyVerified: true,
        message: "Payment already verified",
      });
    }

    const paymentData = {
      sessionId: id,
      status,
      amount_total,
      customer_email,
      userId: metadata.userId,
      payment_status,
      payment_intent,
      payment_date: new Date(),
    };

    // Insert payment
    const result = await payment.insertOne(paymentData);

    // Update user premium status
    const updateResult = await users.updateOne(
      {
        _id: new ObjectId(metadata.userId),
      },
      {
        $set: {
          premium: true,
        },
      }
    );

    return res.send({
      success: true,
      result,
      updateResult,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).send({
      success: false,
      message: "Payment verification failed",
    });
  }
});



app.post("/payment/recruiter-checkout-verify", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).send({
        success: false,
        message: "Session ID is required",
      });
    }

    const session =
      await stripe.checkout.sessions.retrieve(sessionId);

    const {
      id,
      status,
      amount_total,
      customer_email,
      metadata,
      payment_status,
      payment_intent,
    } = session;

    if (status !== "complete" || payment_status !== "paid") {
      return res.send({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Check if payment already exists
    const existingPayment = await payment.findOne({
      sessionId: id,
    });

    if (existingPayment) {
      return res.send({
        success: true,
        alreadyVerified: true,
        message: "Payment already verified",
      });
    }

    const paymentData = {
      sessionId: id,
      status,
      amount_total,
      customer_email,
      userId: metadata.userId,
      payment_status,
      payment_intent,
      payment_date: new Date(),
    };

    // Insert payment
    const result = await payment.insertOne(paymentData);

    // Update user premium status
    const updateResult = await users.updateOne(
      {
        _id: new ObjectId(metadata.recruiterId),
      },
      {
        $set: {
          premium: true,
        },
      }
    );

    return res.send({
      success: true,
      result,
      updateResult,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).send({
      success: false,
      message: "Payment verification failed",
    });
  }
});







app.get("/user/:id/premium", async(req, res) => {

  const id = req.params.id

  const query = {_id : new ObjectId(id)}

  const result = await users.findOne(query, {projection : {premium : 1}})

  res.send(result)
})
app.listen(PORT, () => {
    console.log("app is running on port", PORT)
})


