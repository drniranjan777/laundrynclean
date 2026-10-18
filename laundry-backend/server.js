const app = require('./src/app');
const { connectDB, sequelize } = require('./src/config/db');
const env = require('./src/config/env');

// Load all model associations
require('./src/models/index');

const PORT = env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Sync models (creates tables if they don't exist)
    if (env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
    }

    const server = app.listen(PORT, () => {
      console.log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API Base URL: http://localhost:${PORT}/api/v1`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port or kill the existing process.`);
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
