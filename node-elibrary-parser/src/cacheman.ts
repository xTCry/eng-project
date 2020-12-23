import Fs from 'fs-extra';
import md5 from 'md5';
import logger from './logger';

export class CCacheMan {
    path: string = './temp';
    cache: any = {};

    constructor(path?: string) {
        if (path) {
            this.path = path;
        }
        Fs.ensureDir(this.path).then();
    }

    private async vjuhFilePath(path: string | string[]) {
        if (Array.isArray(path)) {
            if (path.length !== 2) {
                console.error('[cacheman] wrong file! [dir, file]');
                return undefined;
            }
            await Fs.ensureDir(`${this.path}/${path[0]}`);
            return [path[0], path[1]];
        }
        return ['', path];
    }

    public async create(file: string | string[], data: any) {
        return this.update(file, data);
    }

    public async delete(file: string | string[]) {
        let arFile = await this.vjuhFilePath(file);
        if (!arFile) {
            return;
        }
        let [apath, afile] = arFile;

        let path = this.getPath(apath, afile);
        let name = this.genName(afile);
        try {
            delete this.cache[name];
            await Fs.unlink(path);
        } catch (err) {}
    }

    public async update(file: string | string[], data: any, timed: number = 36e4) {
        // console.log('\n\n-----', file, data);

        let arFile = await this.vjuhFilePath(file);
        if (!arFile) {
            return;
        }
        let [apath, afile] = arFile;

        let path = this.getPath(apath, afile);
        let name = this.genName(afile);

        this.cache[name] = {
            time: this.time,
            timed,
            data,
            source: file,
        };

        // this.cache[name] = wrd;
        await Fs.writeFile(path, JSON.stringify(this.cache[name], null, 2));
    }

    public async read(file: string | string[]) {
        let arFile = await this.vjuhFilePath(file);
        if (!arFile) {
            return;
        }

        logger.debug(`[cacheman] load cache (${arFile[1]})`);

        let _data = await this._read(file);
        if (_data === null) {
            return null;
        }

        try {
            let { data, time } = _data;
            return data;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public async _read(file: string | string[], forceFile: boolean = false) {
        let arFile = await this.vjuhFilePath(file);
        if (!arFile) {
            return;
        }
        let [apath, afile] = arFile;

        let name = this.genName(afile);
        if (!forceFile && this.cache[name]) {
            return this.cache[name];
        }

        let path = this.getPath(apath, afile);
        if (!Fs.existsSync(path)) {
            return null;
        }

        let str = await Fs.readFile(path, 'utf8');
        try {
            return JSON.parse(str);
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public isset(file: string | string[], forceFile: boolean = false) {
        let apath = '';
        if (Array.isArray(file)) {
            if (file.length !== 2) {
                console.error('[cacheman] wrong file! [dir, file]');
                return;
            }
            [apath, file] = file;
        }

        let path = this.getPath(apath, file);
        let name = this.genName(file);
        if (!forceFile && this.cache[name]) {
            return true;
        }
        return Fs.existsSync(path);
    }

    /**
     * Is cache file timeout
     */
    public async isTimed(file: string | string[]) {
        let arFile = await this.vjuhFilePath(file);
        if (!arFile) {
            return;
        }

        let _data = await this._read(file);
        if (_data === null) {
            return null;
        }
        let { time, timed } = _data;

        return this.time - (time || 0) > timed;
    }

    public getPath(path: string, file: string) {
        return `${[this.path, path, this.genName(file)].join('/')}.json`;
    }

    public genName(str: string) {
        return `${str.replace(/[^0-9А-яA-z-_]/gi, '').slice(0, 25)}.${md5(str.toLowerCase()).slice(-8)}`;
    }

    public get time() {
        return (Date.now() / 1e3) | 0;
    }
}

const cm = new CCacheMan();
export default cm;
