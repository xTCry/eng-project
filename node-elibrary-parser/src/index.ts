import 'dotenv/config';
import Fs from 'fs-extra';
import Path from 'path';
// @ts-ignore
import sAgent from 'socks5-https-client/lib/Agent';
import { Agent } from 'https';
import logger from './logger';
import { Parser, request } from './parser';

import Readline from './readline';

(async () => {
    let agent: Agent | undefined;
    if (['y'].includes(await Readline.question('Use proxy? [y]: '))) {
        agent = new sAgent({ socksPort: 9050, socksHost: '127.0.0.1' });
        try {
            let agentIp = await request('https://ipv4.icanhazip.com', agent);
            logger.debug('[Proxy] agentIp', agentIp);
        } catch (error) {
            logger.error('[Proxy] Error', error.message);
            agent = undefined;
            await Readline.question('Press Enter to run without proxy...');
        }
    }

    const parser = new Parser(agent);
    try {
        LLoop:
        while (true) {
            switch (await Readline.question('cmd [start]: ')) {
                case 'start': {
                    await parser.Start();
                    break;
                }

                case 'test': {
                    let titleObj = await parser.getArticleTitle(42986163, false);
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
                    await parser.ExtractTitles(['artitles', 'all_titles'], 'out/titles');
                    break;
                }

                // default: {
                case 'end': {
                    logger.info('End');
                    break LLoop;
                }
            }
        }
    } catch (error) {
        logger.error('AppError', error);
    }
    logger.info(`App end.`);
})();
