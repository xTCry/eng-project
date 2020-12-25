import Fs from 'fs-extra';
import Path from 'path';
// @ts-ignore
import sAgent from 'socks5-https-client/lib/Agent';
import { Agent } from 'https';
import './config';
import logger from './logger';
import { ICachedArticles, Parser, request } from './parser';

import Readline from './readline';
import { config } from './config';
import cm from './cacheman';

const useProxy = config.get('USE_PROXY');
const socksPort = config.get('PROXY_PORT');
const socksHost = config.get('PROXY_HOST');

(async () => {
    let agent: Agent | undefined;
    if (useProxy || ['y'].includes(await Readline.question('Use proxy? (y/[n]): '))) {
        agent = new sAgent({ socksPort, socksHost });
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
            switch (await Readline.question('cmd (start/test/clear_bad_cache/remove_duplicate_1/extract/end): ')) {
                case 's':
                case 'start': {
                    await parser.Start();
                    break;
                }

                case 'test': {
                    let titleObj = await parser.getArticleTitle(42986163, false);
                    console.log(titleObj);
                    break;
                }

                case 'cbc':
                case 'clear_bad_cache': {
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

                case 'rd1':
                case 'remove_duplicate_1': {
                    let tempArticles: ICachedArticles = await cm.read(['article', `all_articles`]);
                    if (tempArticles?.arArticles.length > 0) {
                        logger.info(
                            `Loaded ${tempArticles.arArticles.length} articles; lastPage: ${tempArticles.lastPage}`
                        );

                        let lastLen = tempArticles.arArticles.length;
                        tempArticles.arArticles = tempArticles.arArticles.filter(
                            (v, i, a) => a.findIndex((t) => t.id === v.id) === i
                        );

                        logger.info(`Removed ${lastLen - tempArticles.arArticles.length} duplicates`);
                        if (['y'].includes(await Readline.question('Save new cache? (y/[n]): '))) {
                            await cm.update(['article', `all_articles`], tempArticles, 86400);
                        }
                    } else {
                        logger.info(`Cache not found`);
                    }
                    logger.info(`Remove duplicates end`);
                    break;
                }

                case 'ex':
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
