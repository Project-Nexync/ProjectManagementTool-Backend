import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';                    
import dbRoutes from './routes/db.routes.js';
import authRoutes from './routes/auth.route.js';
import projectRoutes from './routes/user.route.js';
import editRoutes from './routes/edit.route.js';
import profileRoutes from './routes/upload.route.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

//enable CORS for all origins (for dev)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json());
app.use('/db', dbRoutes);
app.use('/auth',authRoutes);
app.use("/project", projectRoutes);
app.use("/edit",editRoutes);
app.use("/upload", profileRoutes);

app.get('/', (req, res) => {
  res.send('Hello World');
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
