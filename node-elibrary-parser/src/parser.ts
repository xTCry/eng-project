import Fs from 'fs-extra';
import { load } from 'cheerio';
import chTableParser from 'cheerio-tableparser';
import cm from './cacheman';
import Readline from './readline';
import axios from 'axios';
import logger from './logger';
import { Agent } from 'https';
import { config, IsDebug } from './config';

export interface IArticleTitle {
    title: string;
    titleEng?: string;
}

export interface IArticleInfo {
    // Id of the article on the site
    id: number;
    // Article number from the sellected company
    number: number;
    title: string;
}

export interface ICachedArticles {
    arArticles: IArticleInfo[];
    lastPage: number;
}

export interface ICachedArticlesTitles {
    arTitles: IArticleTitle[];
    lastArticleId: number;
}

const URL_EL = 'https://www.elibrary.ru';
const Cookie = config.get('COOKIE');

export async function request(url: string, httpsAgent?: Agent): Promise<string> {
    let response = await axios({
        url,
        httpsAgent,
        headers: {
            Cookie,
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36',
            Connection: 'keep-alive',
        },
        method: 'GET',
        timeout: 1e4,
        maxRedirects: 8,
    });
    return response.data;
}

export class Parser {
    constructor(public proxy?: Agent) {}

    public async Start() {
        let arArticles = await this.parseArticlesList();
        let articleIds = arArticles.map((e) => e.id);
        logger.info(`Articles loaded: ${articleIds.length}`);

        if (['', 'y'].includes(await Readline.question('Parse articles? ([y]/n): '))) {
            let titles = await this.parseArticlesTitle(articleIds);
            logger.info('Titles:', titles);
        } else {
            logger.info('The End');
        }
    }

    /**
     * request with cache
     */
    public async request(url: string, useCache = true): Promise<string | undefined> {
        let file = url.slice(24);
        let isTimed = await cm.isTimed(['site', file]);

        if (isTimed === false && useCache) {
            return await cm.read(['site', file]);
        }

        let startTime = Date.now();
        IsDebug && logger.debug('try request');

        let response;
        try {
            response = await request(url, this.proxy);
        } catch (err) {
            logger.error(err.message);
            // console.error(err);
            return undefined;
        }

        IsDebug && logger.debug(`New data loaded (${Date.now() - startTime}ms) - ${url}`);
        await cm.update(['site', file], response);

        return response;
    }

    public async parseArticlesList(offsetPage = 0, loadNext = false): Promise<IArticleInfo[]> {
        const URL_EL_YSTU = `${URL_EL}/org_items.asp?orgsid=1219`;
        const body = await this.request(URL_EL_YSTU);
        // is blocked
        if (!body || body.includes('/images/stop.gif') || body.includes('/images/robot2.png')) {
            return [];
        }
        const $ = load(body);

        let lastPageNum = parseInt($('.menurb>:last-child a').attr('href')!.replace(/\D/g, ''));
        logger.info(`Total pages: ${lastPageNum}`);

        let data: ICachedArticles = (await cm.read(['article', `all_articles`])) || {
            arArticles: [],
            lastPage: offsetPage,
        };
        if (data.arArticles.length > 0) {
            logger.info(`Loaded ${data.arArticles.length} articles; lastPage: ${data.lastPage}`);
            if (
                !loadNext &&
                ['', 'y'].includes(
                    await Readline.question('contunue use only cached data ([y]/n) or continue parsing pages: ')
                )
            ) {
                return data.arArticles;
            }
        }

        data.arArticles.push(...this.getListLinks($));

        for (let pageNum = data.lastPage + 1; pageNum <= lastPageNum; ++pageNum) {
            try {
                const body = await this.request(`${URL_EL_YSTU}&pagenum=${pageNum}`);
                if (!body) {
                    continue;
                }
                const $ = load(body);
                let articles = this.getListLinks($);
                data.arArticles.push(...articles);

                if (pageNum % 5 == 0) {
                    await cm.update(['article', `articles_p_${pageNum}`], articles, 86400);
                }
                await cm.update(['article', `all_articles`], data, 86400);
            } catch (error) {
                logger.error(`Error load page (${pageNum})`, error);
            }
            data.lastPage = pageNum;
        }

        await cm.update(['article', `all_articles`], data, 86400);
        return data.arArticles;
    }

    public async parseArticlesTitle(articleIds: number[]) {
        let data: ICachedArticlesTitles = { arTitles: [], lastArticleId: 0 };
        let i = 0;

        let { lastArticleId, arTitles } = (await cm.read(['artitles', `all_titles`])) as ICachedArticlesTitles;
        if (
            lastArticleId > 0 &&
            ['', 'y'].includes(
                await Readline.question(`Skip existing article titles (last artId ${lastArticleId})? ([y]/n): `)
            )
        ) {
            i = arTitles.length;
            data.arTitles = arTitles;
            let lastLen = articleIds.length;
            articleIds = articleIds.slice(articleIds.indexOf(lastArticleId));
            logger.info(`Count skipped ids: ${lastLen - articleIds.length}`);
        }

        for (let id of articleIds) {
            try {
                IsDebug && logger.debug('try load article');

                let titleObj = await this.getArticleTitle(id);
                if (!titleObj || !titleObj.titleEng) {
                    IsDebug && logger.debug('skip article');
                    continue;
                }
                logger.info.lightBlue('ENG found');

                ++i;
                data.arTitles.push(titleObj);
                if (i % 25 == 0) {
                    IsDebug && logger.debug('update titles');
                    await cm.update(['artitles', `titles_p_${i}`], data.arTitles.slice(-i), 86400);
                }
                if (i % 2 == 0) {
                    logger.info.lightGreen(
                        `[${i.toString().padStart(articleIds.length.toString().length, '0')}/${
                            articleIds.length
                        }] Parse title (${id})`
                    );
                    IsDebug && logger.debug('update all titles');
                    await cm.update(['artitles', `all_titles`], data, 86400);
                }
                data.lastArticleId = id;
            } catch (error) {
                logger.error(`Error load title (${id})`, error);
            }
        }

        IsDebug && logger.debug('end update title');
        await cm.update(['artitles', `all_titles`], data, 86400);

        return data.arTitles;
    }

    public getListLinks($: cheerio.Root) {
        let elems = $(`#restab > tbody > tr`).get();

        return elems
            .slice(3)
            .map((e) => {
                try {
                    return {
                        id: parseInt($(e).attr('id')!.replace('arw', '')),
                        number: parseInt($('td:nth-child(1) b', e).text()),
                        title: $('td:nth-child(2) b', e).text(),
                        // link: $('td:nth-child(2) a', e).attr('href'),
                        // description: $('font[color="#00008f"]:last-child', e).text(),
                    } as IArticleInfo;
                } catch (error) {
                    logger.error(error);
                    return null;
                }
            })
            .filter(Boolean) as IArticleInfo[];
    }

    public async getArticleTitle(id: number, useCache = true): Promise<IArticleTitle | undefined> {
        const url = `${URL_EL}/item.asp?id=${id}`;
        const body = await this.request(url, useCache);
        IsDebug && logger.debug('end request');

        if (!body || body.length < 1500) {
            if (body) {
                const $ = load(body!);
                console.log('body', $('html').text().replace(/\n\n/g, ''));
            } else {
                console.log('body', body);
            }

            logger.warn('Human intervention is needed!');

            cm.delete(['site', url.slice(24)]);

            let checked = false;
            while (!checked) {
                let ans = await Readline.question('confirm retry (y/skip): ');
                if (ans == 'skip') {
                    return undefined;
                } else if (ans == 'y') {
                    checked = true;
                    return await this.getArticleTitle(id);
                }
            }
        }
        const $ = load(body!);

        let title = $('p.bigtext').text();
        let titleEng = undefined;

        chTableParser($);

        const parseTables = (tables: any[]) => {
            let data: string[][][] = [];

            for (let table of tables) {
                let el = $(table).parsetable(false, false, true);
                if (el.length < 2 || el[0].length < 2 || el[0][0]?.length < 1 || el[1][1]?.length < 1) {
                    continue;
                }
                data.push(el);
            }
            return data;
        };

        let get$tables = (tableIndex = 1) =>
            $(
                'body > table > tbody > tr > td > table:nth-child(1) > tbody > tr >' +
                    `td:nth-child(2) > table > tbody > tr:nth-child(${tableIndex}) > td:nth-child(1) > div > table`
            );

        let tables = [];
        for (let i = 1; i < 5; i++) {
            tables.push(...parseTables(get$tables(i).get()));
        }

        let tableEng = tables.find((el) =>
            el[0][0].toLowerCase().includes('ОПИСАНИЕ НА АНГЛИЙСКОМ ЯЗЫКЕ'.toLowerCase())
        );

        if (tableEng) {
            titleEng = tableEng[1][1].split('\n')[0];
        }

        return {
            title,
            titleEng,
        };
    }

    public async ExtractTitles(cacheName: string | string[], toFile: string) {
        let { arTitles } = (await cm.read(cacheName)) as { arTitles: IArticleTitle[] };
        if (!arTitles) {
            logger.warn(`Cache "${cacheName}" dosn't contain titles`);
            return;
        }

        let dataAll = arTitles.map((e) => `${e.title}\n${e.titleEng}`).join('\n\n');
        let dataEng = arTitles.map((e) => `${e.titleEng}`).join('\n\n');
        let dataRus = arTitles.map((e) => `${e.title}`).join('\n\n');

        await Fs.writeFile(`${toFile}.all.txt`, dataAll);
        await Fs.writeFile(`${toFile}.en.txt`, dataEng);
        await Fs.writeFile(`${toFile}.ru.txt`, dataRus);
        logger.info(`Titles wee successfully extracted: ${arTitles.length}`);
    }
}
