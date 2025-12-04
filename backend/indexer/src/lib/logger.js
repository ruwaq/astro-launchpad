import pino from 'pino';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
        },
    },
    level: process.env.LOG_LEVEL || 'info',
});
//# sourceMappingURL=logger.js.map