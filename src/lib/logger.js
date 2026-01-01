import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'sarvagyaan-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(), // Easier to read in dev
    }),
    // In production, you would add:
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

export default logger;