const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
var admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

//firebase admin for verifi idtoken
var serviceAccount = require('./red-onion-417b0-firebase-adminsdk-bxati-9f3340b54e.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
//middleware
app.use(cors())
app.use(express.json());

async function VerifyToken(req,res,next){
    if(req.headers.authorization.startsWith('Bearer '))
    {
        const idtoken = req.headers.authorization.split('Bearer ')[1];
        try{
            const decodedUser = await admin.auth().verifyIdToken(idtoken);
            req.decodedUserEmail = decodedUser.email;
        }
        catch{

        }
    }
    next();
}

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.obwta.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run(){
    try{
        await client.connect();

        const database = client.db('RedOnionDB');
        const CustomerCollection = database.collection('CustomerCollection');
        const OrderCollection = database.collection('OrderCollection');

        //get api geting all data
        app.get('/foods', async(req, res) => {
            const cursor = CustomerCollection.find({});
            const page = req.query.page;
            const size = parseInt(req.query.size);
            let foods;
            const count = await cursor.count()
            if(page)
            {
                foods = await cursor.skip(page * size).limit(size).toArray()
            }
            else{
                foods = await cursor.toArray();
            }
            res.send({
                foods,
                count
            })
        })
        //delete order 
        app.delete('/orderfoods/:id', async(req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await OrderCollection.deleteOne(query);
            res.json(result)
        })
        //get for order 
        app.post('/foods', async(req, res) => {
            const order = req.body;
            const d = new Date()
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
            const date = d.toLocaleString('en-US', { timeZone: `${timezone}` });
            order.OrderedAt = date
            const result = await OrderCollection.insertOne(order);
            res.json(result)
        })
        //geting order 
        app.get('/orderfoods',VerifyToken, async(req, res) => {
            const email = req.query.email;
            if(req.decodedUserEmail  === email)
            {
                const query = {email: email}
                const cursor = OrderCollection.find(query)
                const result = await cursor.toArray();
                res.send(result)
            }
            else{
                res.status(401).json({message: 'User Not Authorised'})
            }

        })
        //post for specific id for card
        app.post('/foods/keys', async(req, res) => {
            const keys = req.body;
            const query ={key:{$in: keys}};
            const foods = await CustomerCollection.find(query).toArray();
            res.send(foods)
        })
        //get api getting a data by id
        app.get('/foods/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await CustomerCollection.findOne(query);
            res.send(result)
        })
        //get all orders food
        app.get('/allorder', async(req, res) => {
            const cursor = OrderCollection.find({});
            const order = await cursor.toArray();
            res.send(order)
        })
        //updating status
        app.put('/allorders/:id', async(req, res) => {
            const id = req.params.id;
            const updates = req.body;
            console.log(updates)
            const filter ={_id: ObjectId(id)};
            const options = { upsert: true };
            const updatedoc = {
                $set:{
                    status: updates.status
                },
            };
            const result = await OrderCollection.updateOne(filter, updatedoc, options)
            res.json(result)
        })

    }
    finally{

    }
}
run().catch(console.dir)
app.get('/', (req, res) => {
    res.send('Red Onion Server Connected')
});

app.listen(port, (req, res) => {
    console.log('port is', port)
})