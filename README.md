# SEO Head Parser

[![NPM Version](https://img.shields.io/npm/v/seo-head-parser)](https://www.npmjs.com/package/seo-head-parser)
[![NPM Downloads](https://img.shields.io/npm/dm/seo-head-parser)](https://www.npmjs.com/package/seo-head-parser)
[![NPM License](https://img.shields.io/npm/l/seo-head-parser)](https://www.npmjs.com/package/seo-head-parser)

Lightweight SEO metadata extraction from a webpage's `<head>` section using a streaming HTML parser.

## Features

- Extracts:

  - `<title>`
  - `<meta name="description">`
  - `<meta name="keywords">`
  - OpenGraph (`og:*`), Twitter (`twitter:*`), App Links (`al:*`), and other meta tags
  - `<link rel="canonical">`
  - JSON-LD scripts (`application/ld+json`)
- Streams HTML and stops after `</head>`.
- No external dependencies; relies on Node.js's `http`, `https`, and `stream`.

## Install

```bash
npm install seo-head-parser
```

## Usage

```ts
import { fetchWebHead } from 'seo-head-parser';

const seoData = await fetchWebHead('https://youtu.be/dQw4w9WgXcQ');

console.log(seoData);
```

## API

### `fetchWebHead(url: string, headers?: ObjHeaders)`

Returns a `Promise` resolving to:

```ts
{
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical: string | null;
  meta: Record<string, string | undefined>[];
  al: Record<string, string | undefined>;
  og: Record<string, string | undefined>;
  twitter: Record<string, string | undefined>;
  jsonLd: Record<string, any>[];
}
```

## Notes

- Stops processing after `</head>`.
- Ignores invalid JSON-LD blocks and logs a warning.
- Uses predefined regex patterns for meta tag extraction.
- Not suitable for JS-rendered SEO data.
