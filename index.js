const express = require("express");
const cors = require("cors");
require('dotenv').config()
const {
  MongoClient,
  ServerApiVersion,
  ObjectId
} = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// middlewares
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:");
  next();
});
const corsConfig = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};

app.use(cors(corsConfig))
app.options("", cors(corsConfig))


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@design-mania-bd.kt3v02q.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // client.connect();
    const db = client.db("restho");
    const users = db.collection("users");
    const foods = db.collection("foods");

    // API for collecting new food item data to database
    app.post(`/add-food`, async (req, res) => {
      const food = req.body;
      const result = await foods.insertOne(food);
      res.send(result);
    });

    // API for getting all food items data from database
    app.get('/all-foods', async (req, res) => {
      const page = req.query.page;
      const pageNumber = parseInt(page);
      const perPage = 2;
      const skip = pageNumber * perPage;
      const cursor = await foods.find();
      const allFoods = await cursor.skip(skip).limit(perPage).toArray();
      const foodsCount = await foods.countDocuments();
      res.send({allFoods, foodsCount});
    });

    // API for getting all food items data from database
    app.get('/search', async (req, res) => {
      const keyword = req.query.keyword;
      const query = {name: {$regex: keyword, $options: 'i'}};
      const result = await foods.find(query).toArray();
      res.send(result);
    });
    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({
      ping: 1
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Server is running.....");
});

app.listen(port, () => {
  console.log(`Server is running in port: ${port}`);
});