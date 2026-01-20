// /backend/config/corsOptions.js
const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = ["http://localhost:3000","http://localhost:4000", "https://mernestate-tlmc.onrender.com","http://localhost:5173"];
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ['GET,HEAD,PUT,PATCH,POST,DELETE','OPTIONS'], // Allow specific HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
  };
  
  export default corsOptions;