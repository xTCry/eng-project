import 'dotenv/config';
import { Parser } from './parser';

(async () => {
    const parser = new Parser();
    try {
        await parser.Start();
    } catch (error) {
        console.log('Error', error);
    }
})();
