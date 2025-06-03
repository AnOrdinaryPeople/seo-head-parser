import { request as http } from 'node:http';
import { request as https } from 'node:https';
import { Transform, type TransformCallback } from 'node:stream';
import type {
  KnownTag,
  MetaAttributes,
  Metadata,
  NormalTags,
  ObjHeaders,
} from './types';

class SEOHeadParser extends Transform {
  public readonly metadata: Metadata = {
    title: null,
    description: null,
    keywords: null,
    canonical: null,
    meta: [],
    al: {},
    og: {},
    twitter: {},
    jsonLd: [],
  };
  private readonly knownTags = [
    { tag: 'al', key: 'property' },
    { tag: 'og', key: 'property' },
    { tag: 'twitter', key: 'name' },
  ] satisfies KnownTag[];
  private readonly head = /<\/head\s*>/i;
  private readonly title = /<title[^>]*>([^<]*)<\/title>/i;
  private readonly meta = /<meta\b([^>]*)>/gi;
  private readonly canonical =
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i;
  private readonly jsonLd =
    /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  private readonly jsonLdComments = /\/\*[\s\S]*?\*\//g;
  private readonly attr = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"'\s>]+))/g;
  private buffer = '';
  private headEnded = false;

  constructor() {
    super({ decodeStrings: false });
  }

  override _transform(
    chunk: Buffer,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    if (this.headEnded) return callback();

    this.buffer += chunk.toString();
    const headEndMatch = this.buffer.match(this.head);

    if (typeof headEndMatch?.index !== 'undefined') {
      this.headEnded = true;

      this.parseHead(
        this.buffer.substring(0, headEndMatch.index + headEndMatch[0].length),
      );
      this.end();
    }

    callback();
  }

  override _flush(callback: TransformCallback) {
    if (!this.headEnded && this.buffer) this.parseHead(this.buffer);

    callback();
  }

  private parseHead(content: string) {
    const titleMatch = content.match(this.title);
    const canonicalMatch = content.match(this.canonical);
    const metaTags = content.matchAll(this.meta);
    const jsonLdScripts = content.matchAll(this.jsonLd);

    this.setMetaField('title', titleMatch?.[1]);
    this.setMetaField('canonical', canonicalMatch?.[1]);

    for (const metaMatch of metaTags) {
      if (!metaMatch[1]) continue;

      const metaAttrs = this.parseTagAttrs(metaMatch[1]);

      if (this.setKnownTag(metaAttrs)) continue;

      const name = metaAttrs.name?.toLowerCase();

      switch (name) {
        case 'description':
          this.setMetaField('description', metaAttrs.content);
          break;
        case 'keywords':
          this.setMetaField('keywords', metaAttrs.content);
          break;
        default:
          this.metadata.meta.push(metaAttrs);
          break;
      }
    }

    for (const jsonLdMatch of jsonLdScripts) {
      if (!jsonLdMatch[1]) continue;

      try {
        const jsonContent = jsonLdMatch[1]
          .replace(this.jsonLdComments, '')
          .trim();

        if (jsonContent) {
          const parsedJson = JSON.parse(jsonContent);

          if (Array.isArray(parsedJson)) {
            this.metadata.jsonLd.push(...parsedJson);
          } else {
            this.metadata.jsonLd.push(parsedJson);
          }
        }
      } catch {
        console.warn('Failed to parse JSON-LD:', jsonLdMatch);
      }
    }
  }

  private setMetaField(key: NormalTags, value?: string) {
    if (value) this.metadata[key] = value;
  }

  private parseTagAttrs(attrString: string) {
    const attrs: MetaAttributes = {};
    const attrMatches = attrString.matchAll(this.attr);

    for (const attrMatch of attrMatches) {
      if (!attrMatch[1]) continue;

      const value = attrMatch[2] || attrMatch[3] || attrMatch[4];

      if (value) attrs[attrMatch[1].toLowerCase()] = value;
    }

    return attrs;
  }

  private setKnownTag(metaAttrs: MetaAttributes) {
    for (const knownTag of this.knownTags) {
      const key = metaAttrs[knownTag.key];

      if (key?.startsWith(knownTag.tag + ':')) {
        const prop = key.substring(knownTag.tag.length + 1);
        this.metadata[knownTag.tag][prop] = metaAttrs.content;

        return true;
      }
    }

    return false;
  }
}

export const fetchWebHead = (
  url: string,
  headers?: ObjHeaders,
  redirectCount = 0,
) =>
  new Promise<Readonly<Metadata>>((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    const parsedUrl = new URL(url);
    const request = parsedUrl.protocol === 'https:' ? https : http;
    const req = request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SEO-Head-Parser/1.0',
          ...headers,
          Accept: 'text/html',
        },
      },
      (res) => {
        if (('' + res.statusCode)[0] === '3') {
          const loc = res.headers.location;

          if (!loc)
            return res.destroy(new Error('Redirect with no location header'));

          res.resume();

          return resolve(
            fetchWebHead(
              new URL(loc, url).toString(),
              headers,
              redirectCount + 1,
            ),
          );
        }

        if (res.statusCode !== 200)
          return res.destroy(
            new Error(`Request failed with status code ${res.statusCode}`),
          );

        const transform = new SEOHeadParser();

        res.pipe(transform);
        transform.on('data', () => {});
        transform.on('end', () => resolve(transform.metadata));
        transform.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
