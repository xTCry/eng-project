import Fs from 'fs-extra';
import md5 from 'md5';

export class CCacheMan {
    path: string = './temp/';
    cache: any = {};

    constructor(path?: string) {
        if (path) {
            this.path = path;
        }
        Fs.mkdirp(this.path).then();
    }

    public async create(file: string, data: any) {
        return this.update(file, data);
    }

    public async update(file: string, data: any, timed: number = 36e4) {
        // console.log('\n\n-----', file, data);

        let path = this.getPath(file);
        let name = this.genName(file);

        let wrd = {
            time: this.time,
            timed,
            data,
            source: file,
        };

        this.cache[name] = wrd;
        await Fs.writeFile(path, JSON.stringify(wrd, null, 2));
    }

    public async read(file: string) {
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

    public async _read(file: string, forceFile: boolean = false) {
        let name = this.genName(file);
        if (!forceFile && this.cache[name]) {
            return this.cache[name];
        }

        let path = this.getPath(file);
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

    public isset(file: string, forceFile: boolean = false) {
        let path = this.getPath(file);
        let name = this.genName(file);
        if (!forceFile && this.cache[name]) {
            return true;
        }
        return Fs.existsSync(path);
    }

    /**
     * Is cache file timeout
     */
    public async isTimed(file: string) {
        let _data = await this._read(file);
        if (_data === null) {
            return null;
        }
        let { time, timed } = _data;

        return this.time - (time || 0) > timed;
    }

    public getPath(file: string) {
        return `${this.path}${this.genName(file)}.json`;
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
