/// <reference types="node" />

declare module 'cheerio-tableparser';

declare namespace cheerio {
    interface Cheerio {
        parsetable(dupCols: boolean, dupRows: boolean, textMode: boolean): string[][];
    }
}