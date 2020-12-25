import 'dotenv/config';
import convict from 'convict';
import Fs from 'fs-extra';

export const configSchema = {
    USE_PROXY: {
        doc: 'Use proxy [Socks5]',
        default: false,
        env: 'USE_PROXY',
        arg: 'proxy',
        format: 'Boolean',
    },
    PROXY_PORT: {
        doc: 'Proxy port [Socks5]',
        format: 'port',
        default: 9050,
        env: 'PROXY_PORT',
        arg: 'proxy-port',
    },
    PROXY_HOST: {
        doc: 'Proxy host [Socks5]',
        default: 'localhost',
        env: 'PROXY_HOST',
        arg: 'proxy-host',
    },
    COOKIE: {
        doc: 'Cookies',
        default: 'SUserID=123; SCookieID=456',
        env: 'COOKIE',
        arg: 'cookie',
    },
};

const configPath = './config.json';
export const config = convict(configSchema);

function loadConfig(conv: convict.Config<any>, pathFile: string) {
    if (!Fs.existsSync(pathFile)) {
        console.log(`Created new config file "${pathFile}"`);
        Fs.outputFileSync(pathFile, conv.toString());
    }

    conv.loadFile(pathFile).validate();
}

loadConfig(config, configPath);
