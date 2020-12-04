import 'dotenv/config';
import { Parser } from './parser';

(async () => {
    const parser = new Parser();
    try {
        // await parser.Start();
        await parser.ExtractTitles('titles_p_100', 'out/titles');
    } catch (error) {
        console.log('Error', error);
    }
})();
