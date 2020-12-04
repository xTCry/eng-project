import { load } from 'cheerio';
import superagent from 'superagent';
import cm from './cacheman';

const URL_EL_YSTU = 'https://www.elibrary.ru/org_items.asp?orgsid=1219';

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

export class Parser {
    public async Start(offsetPage = 0) {
        const body = await this.request(URL_EL_YSTU);
        const $ = load(body);

        // let pages = this.getPages($);
        let lastPage = parseInt($('.menurb>:last-child a').attr('href')!.replace(/\D/g, ''));

        let arArticles = [];
        arArticles.push(...this.getListLinks($));

        for (let i = offsetPage + 1; i < lastPage + 1; ++i) {
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
        console.log({ arArticles, lastPage });
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

    public getListLinks($: cheerio.Root): [{
        id: number;
        number: number;
        title: string;
    }] {
        let elems = $(`#restab > tbody > tr`).get();

        return elems.slice(3).map((e) => {
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
        }).filter(Boolean) as any;
    }

    public getPages($: cheerio.Root) {
        return $('.mouse-hovergr[bgcolor="#f5f5f5"] a')
            .get()
            .map((e) => parseInt($(e).text()))
            .filter(Boolean);
    }
}
