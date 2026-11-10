# Visual blog template

Use this for every new post so the blog stays paced and easy to read. The reference page is `blog-surviving-the-silence.html`. Styles live in `blog-article.css`. Link it after `site.css`.

## Page shape

1. Same shell as `blog-spotify-50m-slop.html`: nav, footer, `site.css`, `plai-bubble`.
2. Title and date in `page-hero`.
3. A wide hero image directly under the title.
4. Short paragraphs in a narrow column. One idea per paragraph. Generous space between sections.
5. Two or three section images that break the text. Landscape images use `.post-break`. Tall images add `.tall`.
6. One pull-quote. Big italic line, optional photo backdrop.
7. A 2-up row when the copy has two piles: `.post-piles` for cards, `.post-pair` for images.
8. Close with the existing `cta-band`.

Keep Inter and the PLAIGROUND purple / magenta palette. Do not invent a new brand.

## Files

```
blog-<slug>.html
assets/blog/<slug>/hero.jpg
assets/blog/<slug>/  (2–3 more section images)
```

Add the pretty URL in `vercel.json`:

```json
{ "source": "/blog/<slug>", "destination": "/blog-<slug>.html" }
```

Add the same URL to `sitemap.xml`. Put a card at the top of `blog.html` and bump the post count. Cards can use `.tease-visual` when the post has a hero image.

## Classes

| Class | Use |
| --- | --- |
| `.post-page` | On `<main>` so the title and hero sit tighter. |
| `.post-hero` | Figure + image under the title. Soft radius, light shadow. |
| `.post` | Article wrapper. |
| `.post-col` | Reading column. Short paragraphs live here. |
| `.post-lede` | Opening line, larger than body copy. |
| `.post-beat` | A short punch line inside the column. |
| `.post-break` | Full-width image between sections. |
| `.post-break.tall` | Portrait image, centered, not cropped into a strip. |
| `.pull-quote` | Big italic line. Set `--quote-image` when you have a backdrop. |
| `.post-piles` | Two cards. The second card is the one the reader should keep. |
| `.post-pair` | Two images side by side. Stacks on a phone. |
| `.tease-visual` | Top card on `blog.html` with the hero still. |

## Copy rules

- Ship the page clean. No draft banner.
- No personal names, handles, or photo credits.
- Hero, then the section images, then the pull-quote. Do not dump every image at the top.
- Alt text describes the picture. Leave decorative backdrops as CSS backgrounds.

## Font

Pull-quotes are italic. Load Inter italic on the page:

`family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,500;1,600`
