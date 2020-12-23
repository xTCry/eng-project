import ReadLine from 'readline';
import chalk from 'chalk';
import { log } from './logger';

export type HandlerCallback = (...args: any) => boolean | unknown;

export class CReadline {
    // ReadLine
    protected rl = ReadLine.createInterface(process.stdin, process.stdout);

    private readonly handlers: Map<string, HandlerCallback[]> = new Map();

    constructor({ needPrompt = true }: { needPrompt?: boolean } = {}) {
        this.init();

        if (needPrompt) {
            this.Prompt();
        }
    }

    public question(question: string): Promise<string> {
        return new Promise((resolve) => this.rl.question(question, resolve));
    }

    /**
     * Prompt
     */
    public Prompt() {
        this.rl.setPrompt(chalk.grey('_> '));
        this.rl.prompt();
        return this;
    }

    private init() {
        this.rl.on('line', async (line: string) => {
            const [key, ...args] = line.trim().split(' ');

            switch (key.toLocaleLowerCase()) {
                case '':
                    break;

                case 'test': {
                    log.info('Q', ...args);
                    break;
                }
            }

            if (this.handlers.has(key)) {
                for (const handler of this.handlers.get(key)!) {
                    const response = handler(...args);
                    if (typeof response === 'boolean' && !response) {
                        break;
                    }
                }
            }
        });
    }

    /**
     * on
     */
    public on(key: string, handler: HandlerCallback) {
        key = key.toLocaleLowerCase();
        if (this.handlers.has(key)) {
            this.handlers.get(key)!.push(handler);
        } else {
            this.handlers.set(key, [handler]);
        }

        return this;
    }
}

const Readline = new CReadline();
export default Readline;
