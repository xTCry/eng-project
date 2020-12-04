import Fs from 'fs-extra';
import { load } from 'cheerio';
import superagent from 'superagent';
import chTableParser from 'cheerio-tableparser';
import cm from './cacheman';

const URL_EL = 'https://www.elibrary.ru';

const request = async (url: string): Promise<string> =>
    new Promise((resolve, reject) =>
        superagent
            .agent()
            .get(url)
            .redirects(5)
            .send()
            .end((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.text);
                }
            })
    );

interface IArticleTitle {
    title: string;
    titleEng?: string;
}

export class Parser {
    public async Start() {
        let arArticles = await this.parseArticlesList();
        let articleIds = arArticles.map((e) => e.id);
        let titles = await this.parseArticlesTitle(articleIds);
        console.log(titles);
    }

    /**
     * request with cache
     */
    public async request(url: string): Promise<string> {
        let file = url.slice(24);
        let isTimed = await cm.isTimed(file);

        if (isTimed === false) {
            return await cm.read(file);
        }

        let startTime = Date.now();
        let response = await request(url);
        console.log(`New data loaded (${Date.now() - startTime}ms) - ${url}`);

        await cm.update(file, response);
        return response;
    }

    public async parseArticlesList(offsetPage = 0) {
        const URL_EL_YSTU = `${URL_EL}/org_items.asp?orgsid=1219`;
        const body = await this.request(URL_EL_YSTU);
        const $ = load(body);

        // let pages = this.getPages($);
        let lastPage = parseInt($('.menurb>:last-child a').attr('href')!.replace(/\D/g, ''));

        let arArticles = [];
        arArticles.push(...this.getListLinks($));

        for (let i = offsetPage + 1; i <= lastPage; ++i) {
            try {
                const body = await this.request(`${URL_EL_YSTU}&pagenum=${i}`);
                const $ = load(body);
                let articles = this.getListLinks($);
                arArticles.push(...articles);

                if (i % 5 == 0) {
                    await cm.update(`articles_p_${i}`, articles, 86400);
                }
            } catch (error) {
                console.log(`Error load page (${i})`, error);
            }
        }

        await cm.update(`all_articles`, arArticles, 86400);
        return arArticles;
    }

    public async parseArticlesTitle(articleIds: number[]) {
        let arTitles = [];
        let i = 0;
        for (let id of articleIds) {
            try {
                let titleObj = await this.getArticleTitle(id);
                if (!titleObj.titleEng) {
                    continue;
                }

                ++i;
                arTitles.push(titleObj);
                if (i % 100 == 0) {
                    await cm.update(`titles_p_${i}`, arTitles.slice(-i), 86400);
                }
                if (i % 20 == 0) {
                    console.log(
                        `[${i.toString().padStart(articleIds.length.toString().length, '0')}/${
                            articleIds.length
                        }] Parse title (${id})`
                    );
                }
            } catch (error) {
                console.log(`Error load title (${id})`, error);
            }
        }

        await cm.update(`all_titles`, arTitles, 86400);
        return arTitles;
    }

    public getListLinks(
        $: cheerio.Root
    ): [
        {
            id: number;
            number: number;
            title: string;
        }
    ] {
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
                    };
                } catch (error) {
                    console.log(error);
                    return null;
                }
            })
            .filter(Boolean) as any;
    }

    public async getArticleTitle(id: number): Promise<IArticleTitle> {
        const body = await this.request(`${URL_EL}/item.asp?id=${id}`);
        const $ = load(body);

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

        let $tables = $(
            'body > table > tbody > tr > td > table:nth-child(1) > tbody > tr >' +
                'td:nth-child(2) > table > tbody > tr:nth-child(3) > td:nth-child(1) > div > table'
        );

        let tables = parseTables($tables.get());
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

    public getPages($: cheerio.Root) {
        return $('.mouse-hovergr[bgcolor="#f5f5f5"] a')
            .get()
            .map((e) => parseInt($(e).text()))
            .filter(Boolean);
    }

    public async ExtractTitles(cacheName: string, toFile: string) {
        let arTitles = (await cm.read(cacheName)) as IArticleTitle[];

        let dataAll = arTitles.map((e) => `${e.title}\n${e.titleEng}`).join('\n\n');
        let dataEng = arTitles.map((e) => `${e.titleEng}`).join('\n\n');
        let dataRus = arTitles.map((e) => `${e.title}`).join('\n\n');

        await Fs.writeFile(`${toFile}.all.txt`, dataAll);
        await Fs.writeFile(`${toFile}.en.txt`, dataEng);
        await Fs.writeFile(`${toFile}.ru.txt`, dataRus);
    }
}
