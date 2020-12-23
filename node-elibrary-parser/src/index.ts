import 'dotenv/config';
import Fs from 'fs-extra';
import Path from 'path';
import logger from './logger';
import { Parser } from './parser';

import Readline from './readline';

(async () => {
    const parser = new Parser();
    try {
        switch (await Readline.question('cmd [start]: ')) {
            case 'start': {
                await parser.Start();
                break;
            }

            case 'test': {
                let titleObj = await parser.getArticleTitle(42986163);
                console.log(titleObj);
                break;
            }

            case 'clearbad': {
                let counter = 0;
                const dir = './temp/site/';
                let files = await Fs.readdir(dir);
                for (const file of files) {
                    let path = Path.join(dir, file);
                    let str = await Fs.readFile(path, 'utf8');
                    try {
                        let { data } = JSON.parse(str);
                        if (data.length < 1500) {
                            ++counter;
                            await Fs.unlink(path);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
                logger.info(`Removed ${counter} bad files`);
                break;
            }

            case 'extract': {
                await parser.ExtractTitles('titles_p_100', 'out/titles');
                break;
            }

            default: {
                logger.info('Restart app');
                break;
            }
        }
    } catch (error) {
        logger.error('AppError', error);
    }
    logger.info(`App end.`);
})();
