const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User= require('./Schema'); 
const Accident=require('./Schema');
dotenv.config();
const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/accident", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(()=>{
  console.log("MongoDB connected successfully")
}).catch((err)=>{
  console.log(err);
});

// const userSchema = new mongoose.Schema({
//   username: String,
//   password: String,
//   role: String, // 'admin' or 'user'
// });



// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ message: "Access Denied" });
  const token = authHeader.split(" ")[1]; // Remove "Bearer "
  //console.log(token);

  try {
    //console.log("JWT_SECRET:", process.env.JWT_SECRET);
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
   // console.log(verified);
    next();
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "Invalid Token" });
  }
};
//get all accidents

app.get('/accidents', verifyToken,async (req, res) => {
  try {
    const accidents = await Accident.find(); // Fetch all accidents
    res.status(200).json(accidents);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving accidents', error });
  }
});
//getting all users
app.get('/users',verifyToken, async (req, res) => {
  try {
    const users = await User.find({ role: "user" }); // Fetches only users (not admins)
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
});


// get user -compelted accidents
app.get('/user/:userId/completed-accidents',verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate({
      path: "accidents.accident",
      match: { "accidents.status": "completed" } // Filter only completed ones
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const completedAccidents = user.accidents.filter(a => a.status === "completed");

    res.status(200).json(completedAccidents);
  } catch (error) {
    res.status(500).json({ message: "Error fetching completed accidents", error });
  }
});
// delete accident when accepted by driver 
app.delete('/accidents/:id', async (req, res) => {
  try {
    const accidentId = req.params.id;
    const deletedAccident = await Accident.findByIdAndDelete(accidentId);

    if (!deletedAccident) {
      return res.status(404).json({ message: "Accident not found" });
    }

    res.status(200).json({ message: "Accident deleted successfully", deletedAccident });
  } catch (error) {
    res.status(500).json({ message: "Error deleting accident", error });
  }
});
// adding new accidents
app.post('/accidents', async (req, res) => {
  try {
    const { location, complete_address, lat, lng, maps_link, datetime, severity_label } = req.body;

    // Validate required fields
    if (!location || !complete_address || !lat || !lng || !datetime || !severity_label) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create new accident document
    const newAccident = new Accident({
      location,
      complete_address,
      lat,
      lng,
      maps_link,
      datetime,
      severity_label
    });

    // Save to database
    await newAccident.save();
    res.status(201).json({ message: "Accident added successfully", accident: newAccident });

  } catch (error) {
    res.status(500).json({ message: "Error adding accident", error });
  }
});

// Admin Login
app.post("/admin/login", async (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;
  const admin = await User.findOne({ username, role: "admin" });
  if (!admin) return res.status(400).json({ message: "Admin not found" });

  console.log(password,admin.password);


  if(admin.password !== password) 
   return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign({ _id: admin._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// User Login
app.post("/user/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, role: "user" });
  if (!user) return res.status(400).json({ message: "User not found" });


  const validPass = await bcrypt.compare(password, user.password);
  if (!validPass) return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign({ _id: user._id, role: "user" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// Admin adds a user
app.post("/admin/adduser", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

  const { username, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const oldUser = await User.findOne({username:username});
  console.log(oldUser)
  if(oldUser){
    res.json({message:"User already exist"});
  }
  else
  {const newUser = new User({ username, password: hashedPassword, role: "user" });
  await newUser.save();
  res.json({ message: "User added successfully" });}
});

app.post('/',(req,res)=>{
  console.log(req.body);
  res.json(req.body);
})

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));