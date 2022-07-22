# Eleventy Islands Preact
Proof of concept for interactive islands with Eleventy, Preact and ESBuild.

I hacked this together for my blog and didn't end up using it, but it might still be a useful reference for future work in this space.

## Example
Add the plugin to an eleventy config.

```ts
eleventyConfig.addPlugin(preactIslands);
```

Then use the following shortcodes to embed interactive/static Preact components into your pages.

```md
## Hydration
The component below will be rendered at build time, then hydrated at runtime.
{% renderComponent "./Counter" %}

## Client
The component below will be bundled at build time and rendered at runtime.
{% renderClientComponent "./Counter" %}

## Static
The component below will be rendered at build time and no JS was sent to the client.
{% renderStaticComponent "./Counter" %}
```

## Caveats
Currently, imported CSS won't be linked to the resulting HTML because of [an open issue with ESBuild's output format](https://github.com/evanw/esbuild/issues/1861). With multi-entrypoint builds, it's not possible to tell from the output which CSS file came from which entrypoint.
