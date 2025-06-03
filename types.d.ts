import type { RequestOptions } from 'node:http';

type MetaAttributes = Record<string, string | undefined>;

// biome-ignore lint/suspicious/noExplicitAny: JSON-LD can be any data
type JsonLd = Record<string, any>;

export interface Metadata {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical: string | null;
  meta: MetaAttributes[];
  al: MetaAttributes;
  og: MetaAttributes;
  twitter: MetaAttributes;
  jsonLd: JsonLd[];
}

export type NormalTags = {
  [K in keyof Metadata]: Metadata[K] extends string | null ? K : never;
}[keyof Metadata];

type SpecialTags = {
  [K in keyof Metadata]: Metadata[K] extends MetaAttributes ? K : never;
}[keyof Metadata];

export interface KnownTag<T extends SpecialTags = SpecialTags> {
  tag: T;
  key: string;
}

export type ObjHeaders<
  T extends RequestOptions['headers'] = RequestOptions['headers'],
> = T extends readonly string[] ? never : T;

declare function fetchWebHead(
  url: string,
  headers?: ObjHeaders,
): Promise<Readonly<Metadata>>;
