import pino from 'pino';
// @ts-expect-error - Pino type signature issue with transport
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