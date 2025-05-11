declare module "fontmin" {
  import { Buffer } from "buffer";

  export interface FontminFile {
    contents: Buffer;
    path: string;
  }

  export default class Fontmin {
    constructor();
    src(path: string): this;
    use(plugin: any): this;
    dest(path: string): this;
    run(cb: (err: Error | null, files: FontminFile[]) => void): void;

    static glyph(options: { text: string; hinting?: boolean }): any;
    static ttf2woff2(): any;
  }
}
