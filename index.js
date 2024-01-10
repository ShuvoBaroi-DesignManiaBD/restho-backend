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
    const foods = db.collection("foods");
    const cart = db.collection("cart");
    const orders = db.collection("orders");

    // ============= Food CRUD operations ================
    // API for collecting new food item data to database
    app.post(`/add-food`, async (req, res) => {
      try {
        const food = req.body;
        const result = await foods.insertOne(food);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // API for getting a specific food data
    app.get('/foods/:name', async (req, res) => {
      try {
        const foodName = (req.params.name).replace(/-/g, ' ');
        const query = {
          name: {
            $regex: new RegExp('^' + foodName, 'i')
          }
        };
        const food = await foods.findOne(query);
        return res.json(food);
      } catch (error) {
        console.error(error);
        res.status(500).json({
          error: 'Internal Server Error'
        });
      }
    });

    // API for getting all food items data from database
    app.get('/all-foods', async (req, res) => {
      try {
        const page = req.query.page;
        const pageNumber = parseInt(page);
        const perPage = 8;
        const skip = pageNumber * perPage;
        const cursor = await foods.find();
        const result = await cursor.skip(skip).limit(perPage).toArray();
        const foodsCount = await foods.countDocuments();
        res.send({
          foods: result,
          foodsCount
        });
      } catch (error) {
        console.log(error);
      }
    });
    
    // API for getting all food items data from database
    app.get('/top-selling-foods', async (req, res) => {
      try {
        const quantity = req.query.quantity || 4;
        const cursor = await foods.find();
        const result = await cursor.sort( { orderCount: -1 } ).limit(quantity).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // API for getting all food items data from database
    app.get('/added-foods', async (req, res) => {
      try {
        const email = req.query.email;
        const page = req.query.page ? Number(req.query.page) : 0;
        const query = {
          ownerEmail: email
        }
        const pageNumber = parseInt(page);
        const perPage = 2;
        const skip = pageNumber * perPage;
        const cursor = await foods.find(query);
        const result = await cursor.skip(skip).limit(perPage).toArray();
        const foodsCount = await foods.countDocuments(query);
        res.send({
          result,
          foodsCount
        });
      } catch (error) {
        console.log(error);
      }
    });

    // API for searching a food data
    app.get('/search', async (req, res) => {
      try {
        const keyword = req.query.keyword;
        const page = req.query.page;
        const pageNumber = parseInt(page);
        const perPage = 2;
        const skip = pageNumber * perPage;
        const query = {
          name: {
            $regex: keyword,
            $options: 'i'
          }
        };
        const result = await foods.find(query).skip(skip).limit(perPage).toArray();
        const foodsCount = await foods.countDocuments(query);
        console.log(result, foodsCount);
        res.send({
          foods: result,
          foodsCount
        });
      } catch (error) {
        console.log(error);
      }
    });

    // =============== Cart CRUD opearations ===============
    app.put(`/cart/add`, async (req, res) => {
      try {
        const food = req.body;
        const foodId = food.foodId;
        const quantity = food.cartQuantity;
        const userQuery = {
          userId: food.userId
        };
        const foodQuery = {
          _id: new ObjectId(foodId)
        };

        const searchFood = await foods.findOne(foodQuery);
        if (!searchFood) {
          return res.status(404).json({
            error: 'Food item not found'
          });
        }

        const newQuantity = Number(searchFood.quantity) - Number(food.cartQuantity);
        if (newQuantity < 0) {
          return res.status(400).json({
            error: 'Insufficient quantity'
          });
        }

        const updateFood = {
          $set: {
            quantity: newQuantity,
          }
        };
        const updateFoodItem = await foods.updateOne(foodQuery, updateFood);

        const cartItem = {
          ...food,
          cartQuantity: quantity,
        };

        const existingItemQuery = {
          userId: food.userId,
          foodId: food.foodId
        };

        const existingItemProjection = {
          items: {
            $elemMatch: {
              _id: foodId
            }
          }
        };

        const existingItem = await cart.findOne(existingItemQuery);

        if (existingItem) {
          const newQuantity = Number(existingItem.cartQuantity + quantity);
          const newTotal = newQuantity * food.price;
          console.log(existingItem, newQuantity);

          const updateExistingItem = {
            $set: {
              cartQuantity: newQuantity,
              total: newTotal
            }
          };
          const updatedItem = await cart.updateOne(existingItemQuery, updateExistingItem);
          return res.json(updatedItem);
        } else {
          const cartData = {
            createdAt: Date.now(),
            ...food
          }
          console.log(cartData);
          const insertCart = await cart.insertOne(cartData);
          return res.json(insertCart);
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          error: 'Internal Server Error'
        });
      }
    });

    // API for updating a food data
    app.put(`/food/update`, async (req, res) => {
      try {
        const food = req.body;
        const foodId = req.query.id;
        const foodQuery = {
          _id: new ObjectId(foodId)
        };
        const updateFood = {
          $set: {
            ...food
          }
        };
        const result = await foods.updateOne(foodQuery, updateFood);
        res.send(result);
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          error: 'Internal Server Error'
        });
      }
    });

    // API for getting cart items
    app.get('/cart/get', async (req, res) => {
      try {
        const id = req.query.id;
        const userQuery = {
          userId: id
        };
        const userCart = await cart.find(userQuery).toArray() || [];
        return res.json(userCart);
      } catch (error) {
        console.error(error);
      }
    });

    // API for deleting a specific user's cart items
    app.delete('/cart/user/delete', async (req, res) => {
      try {
        const id = req.query.id;
        const userQuery = {
          userId: id
        };
        const result = await cart.deleteMany(userQuery);

        res.send(result);
      } catch (error) {
        console.error('Error:', error);
      }
    });

    // API for deleting a food from a specific user's cart items
    app.delete('/cart/user/food/delete', async (req, res) => {
      try {
        const id = req.query.userid;
        const food_id = req.query.foodid;
        const cartQuantity = req.query.qty;
        const userQuery = {
          userId: id,
          foodId: food_id
        };

        const foodQuery = {
          _id: new ObjectId(food_id)
        };
        const searchFood = await foods.findOne(foodQuery);
        const newQuantity = Number(searchFood.quantity) + Number(cartQuantity);
        const updateFood = {
          $set: {
            quantity: newQuantity,
          }
        };
        const updateFoodItem = await foods.updateOne(foodQuery, updateFood);
        const result = await cart.deleteMany(userQuery);

        res.send({
          result,
          updateFoodItem
        });
      } catch (error) {
        console.error('Error:', error);
      }
    });

    // =============== Orders related APIs ==================
    // API for add new order data
    app.post(`/orders/add-new`, async (req, res) => {
      try {
        const orderData = req.body;
        orderData.map(async (item) => {
          const foodQuery = {
            _id: new ObjectId(item.foodId)
          };
          const searchFood = await foods.findOne(foodQuery);
          const newQuantity = Number(searchFood.orderCount) + Number(item.cartQuantity);
          const updateFood = {
            $set: {
              orderCount: newQuantity,
            }
          };
          const updateFoodItem = await foods.updateOne(foodQuery, updateFood);
        })
        const result = await orders.insertMany(orderData);
        res.json(result);
      } catch (error) {
        console.error(error);
      }
    });


    // API for getting a specific user's orders data
    app.get('/orders/get', async (req, res) => {
      try {
        const id = req.query.id;
        const page = req.query.page;
        const pageNumber = parseInt(page);
        const perPage = 5;
        const skip = pageNumber * perPage;
        const userQuery = {
          userId: id
        };
        const cursor = await orders.find(userQuery);
        const result = await cursor.skip(skip).limit(perPage).toArray();
        const countOrders = await orders.countDocuments(userQuery);
        // console.log(userOrders, countOrders); 
        return res.json({
          result,
          countOrders
        });
      } catch (error) {
        console.error(error);
      }
    });

    // API for deleting a specific user's specific order
    app.delete('/orders/delete', async (req, res) => {
      try {
        const id = req.query.id;
        const orderQuery = {
          _id: id
        }
        const findOrder = await orders.findOne(orderQuery);
        const foodId = findOrder.foodId;
        const foodQuery = {
          _id: new ObjectId(foodId)
        };
        const food = await foods.findOne(foodQuery);
        const newQuantity = Number(findOrder.cartQuantity + food.quantity);
        const updateFood = await foods.updateOne(foodQuery, {
          $set: {
            quantity: newQuantity
          },
        });
        const deleteResult = await orders.deleteOne(orderQuery);

        res.send({
          updateFood,
          deleteResult
        });
      } catch (error) {
        console.error('Error:', error);
      }
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