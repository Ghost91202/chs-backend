const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const multer = require('multer');

dotenv.config();

const app = express();
const port = 5000;
// app.use(cors());
app.use('/uploads', express.static('uploads'));

app.use(cors({
  origin: 'https://chs-school-demo-awutg4mia-ghost91202.vercel.app', // Replace with the actual URL of your React app
  credentials: true,
}));
// Middleware to parse JSON requests
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});
const secretKey = process.env.JWT_SECRET || 'your-default-secret-key';

// Define a schema for user registration
const User = mongoose.model('User', {
  email: String,
  name: String,
  number: String,
  class: String,
  address: String,
  password: String,
  role: String,
  passportImage: {
    type: String,
    default: null,
  }, // Add new fields for students
  fatherName: String,
  motherName: String,
  age: Number,
  birthdate: String,
  gender: String,
});

// Update the registrationSchema
const registrationSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  number: z.string().min(10).optional(),
  class: z.string().optional(),
  address: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['admin', 'student']),
  passportImage: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  age: z.number().optional(),
  birthdate: z.string().optional(),
  gender: z.string().optional(),
});
// ===========================================================
// image 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Specify the destination folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname); // Append a unique suffix to the filename
  },
});

const upload = multer({ storage: storage });


// Middleware to validate the registration payload
const validateRegistration = (req, res, next) => {
  try {
    const validatedData = registrationSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    console.error('Validation error:', error.errors);
    res.status(400).json({ error: 'Invalid registration data' });
  }
};

// Middleware to hash passwords before saving them
const hashPassword = async (req, res, next) => {
  req.body.password = await bcrypt.hash(req.body.password, 10);
  next();
};


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});
// Middleware to send an email upon successful registration
const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
};

// ... (existing code)

app.post('/send-test-email', async (req, res) => {
  const { email, name } = req.body;

  const mailOptions = {
    from: 'karansharma8543@gmail.com',
    to: email,
    subject: 'Test Email',
    text: `Hello ${name},\nThis is a test email.`,
  };

  // Use the existing transporter for sending test emails
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: 'Error sending test email', details: error.message });
    } else {
      console.log('Test email sent:', info.response);
      res.json({ message: 'Test email sent successfully' });
    }
  });
});

// Registration endpoint
// Registration endpoint
// Registration endpoint
app.post('/register', upload.single('passportImage'), validateRegistration, hashPassword, async (req, res) => {
  const {
    email,
    name,
    number,
    class: studentClass,
    address,
    password,
    role,
    passportImage,
    fatherName,
    motherName,
    age,
    birthdate,
    gender,
  } = req.body;

  try {
    console.log('Received birthdate:', birthdate);

    // Check if the user already exists in the database
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // User already exists, send a response with a message and a link to the login form
      return res.status(400).json({
        error: 'User already exists. Please log in.',
        loginLink: '/login', // Provide the link to your login form
      });
    }

    // User doesn't exist, proceed with registration

    // Check if an image is uploaded
    let uploadedImage = null;
    if (req.file) {
      // Check the file size (max size in bytes)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds the limit of 5MB!' });
      }
      uploadedImage = req.file.filename;
    }

    const user = new User({
      email,
      name,
      number,
      class: studentClass,
      address,
      password,
      role,
      passportImage: uploadedImage, // Use the filename if an image is uploaded
      fatherName,
      motherName,
      age,
      birthdate, // No need to convert, as it's already a Date object
      gender,
    });

    await user.save();

    console.log('User registered successfully');
    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error saving user to the database:', error.message);
    res.status(500).json({ error: 'Error saving user to the database' });
  }
});





// 
app.post('/register-admin', validateRegistration, hashPassword, async (req, res) => {
  const { email, name, number, address, password, role, gender, passportImage } = req.body;

  try {
    // Check if the user already exists in the database
    const existingAdmin = await User.findOne({ email, role: 'admin' });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with the provided email already exists' });
    }

    // Admin doesn't exist, proceed with registration
    const admin = new User({
      email,
      name,
      number,
      address,
      password,
      role: 'admin',
      gender,
      passportImage,
    });

    await admin.save();

    console.log('Admin registered successfully');
    res.json({ message: 'Admin registered successfully' });
  } catch (error) {
    console.error('Error saving admin to the database:', error.message);
    res.status(500).json({ error: 'Error saving admin to the database' });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
      
      // Store the token in localStorage
      res.cookie('token', token, { httpOnly: true, expires: new Date(Date.now() + 3600000) });

      
      res.json({ token, role: user.role });
    } else {
      console.error('Invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).json({ error: 'Error during login' });
  }
});



const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(403).json({ error: 'Access denied. Invalid token.' });
  }
};

app.get('/student-data', authenticateToken, async (req, res) => {
  const { role, email } = req.user;

  if (role === 'student') {
    try {
      const studentData = await User.findOne({ email });
      res.json(studentData);
    } catch (error) {
      console.error('Error fetching student data:', error.message);
      res.status(500).json({ error: 'Error fetching student data' });
    }
  } else {
    res.status(403).json({ error: 'Permission denied' });
  }
});

// Protected route to get all data based on user role
// app.get('/all-data', authenticateToken, async (req, res) => {
//   const { role } = req.user;

//   if (role === 'admin') {
//     try {
//       const allData = await User.find();
//       res.json(allData);
//     } catch (error) {
//       console.error('Error fetching all data:', error.message);
//       res.status(500).json({ error: 'Error fetching all data' });
//     }
//   } else {
//     res.status(403).json({ error: 'Permission denied' });
//   }
// });


// ... (existing code)

// Protected route to get all data based on user role
app.get('/all-data', authenticateToken, async (req, res) => {
  const { role } = req.user;

  try {
    let allData;

    if (role === 'admin') {
      const searchTerm = req.query.searchTerm || ''; // Retrieve the search term from the query parameters
      const regex = new RegExp(searchTerm, 'i'); // Create a case-insensitive regular expression

      // Use the regex to filter data based on the search term
      allData = await User.find({
        $or: [
          { email: { $regex: regex } },
          { name: { $regex: regex } },
          { number: { $regex: regex } },
          { class: { $regex: regex } },
          { address: { $regex: regex } },
          // Add other fields accordingly
        ],
      }).exec();
    } else {
      return res.status(403).json({ error: 'Permission denied' });
    }

    res.json(allData);
  } catch (error) {
    console.error('Error fetching all data:', error.message);
    res.status(500).json({ error: 'Error fetching all data' });
  }
});

// ... (existing code)
// search api 


// Add this endpoint in your existing Express app
app.get('/search', authenticateToken, async (req, res) => {
  const { searchTerm } = req.query;

  try {
    // Customize this query based on your MongoDB data structure
    const searchResults = await User.find({
      $or: [
        { name: { $regex: new RegExp(searchTerm, 'i') } },
        { class: { $regex: new RegExp(searchTerm, 'i') } },
        // Add more fields as needed
      ],
    }).exec();

    res.json(searchResults);
  } catch (error) {
    console.error('Error performing search:', error.message);
    res.status(500).json({ error: 'Error performing search' });
  }
});



// ================================api for update data =========================================
// ... (existing code)

// Protected route to add a new student
app.post('/add-student', authenticateToken, async (req, res) => {
  const { role } = req.user;

  if (role === 'admin') {
    const { email, name, number, class: studentClass, address, password } = req.body;

    try {
      const newUser = new User({
        email,
        name,
        number,
        class: studentClass,
        address,
        password,
        role: 'student', // Ensure the role is 'student'
      });

      await newUser.save();

      console.log('Student added successfully');
      res.json({ message: 'Student added successfully' });
    } catch (error) {
      console.error('Error adding student:', error.message);
      res.status(500).json({ error: 'Error adding student' });
    }
  } else {
    res.status(403).json({ error: 'Permission denied' });
  }
});

// Protected route to update a student's data
app.put('/update-student/:id', authenticateToken, async (req, res) => {
  const { role } = req.user;

  if (role === 'admin') {
    const studentId = req.params.id;
    const { email, name, number, class: studentClass, address, password } = req.body;

    try {
      const updatedStudent = await User.findByIdAndUpdate(studentId, {
        email,
        name,
        number,
        class: studentClass,
        address,
        password,
      });

      if (!updatedStudent) {
        return res.status(404).json({ error: 'Student not found' });
      }

      console.log('Student updated successfully');
      res.json({ message: 'Student updated successfully' });
    } catch (error) {
      console.error('Error updating student:', error.message);
      res.status(500).json({ error: 'Error updating student' });
    }
  } else {
    res.status(403).json({ error: 'Permission denied' });
  }
});

// Protected route to remove a student
// Update the removal endpoint
app.delete('/remove-student/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await User.deleteOne({ _id: id });
    if (result.deletedCount === 1) {
      res.json({ message: 'Student removed successfully' });
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  } catch (error) {
    console.error('Error removing student:', error.message);
    res.status(500).json({ error: 'Error removing student' });
  }
});


// ... (existing code)
// ======================================================================================
app.post('/add-admin', authenticateToken, async (req, res) => {
  const { email, name, number, address, password } = req.body;

  try {
    const existingAdmin = await User.findOne({ email, role: 'admin' });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with the provided email already exists' });
    }

    const admin = new User({
      email,
      name,
      number,
     
      address,
      password,
      role: 'admin',
    });

    await admin.save();

    console.log('Admin added successfully');
    res.json({ message: 'Admin added successfully' });
  } catch (error) {
    console.error('Error adding admin:', error.message);
    res.status(500).json({ error: 'Error adding admin' });
  }
});


// ========================================================== 


// Add this endpoint in your existing Express app
app.get('/all-classes', authenticateToken, async (req, res) => {
  try {
    const classes = await User.distinct('class').exec();
    res.json(classes);
  } catch (error) {
    console.error('Error fetching all classes:', error.message);
    res.status(500).json({ error: 'Error fetching all classes' });
  }
});


// Add this endpoint in your existing Express app
app.get('/students-of-class/:className', authenticateToken, async (req, res) => {
  const { className } = req.params;

  try {
    const students = await User.find({ class: className }).exec();
    res.json(students);
  } catch (error) {
    console.error('Error fetching students of class:', error.message);
    res.status(500).json({ error: 'Error fetching students of class' });
  }
});

// ------------------------------------------------------------

app.get('/all-classes', authenticateToken, async (req, res) => {
  try {
    const classes = await User.distinct('class').exec();
    res.json(classes);
  } catch (error) {
    console.error('Error fetching all classes:', error.message);
    res.status(500).json({ error: 'Error fetching all classes' });
  }
});
// ==========================================================


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
