import ololog from 'ololog';

export const log = ololog.configure({
    time: true,
    tag: true,
});
export default log;

process.on('uncaughtException', (e) => {
    log.bright.red.error.noLocate(e);
});
process.on('unhandledRejection', (e) => {
    log.bright.red.error.noLocate(e);
});
