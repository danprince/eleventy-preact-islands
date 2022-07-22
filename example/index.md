# Eleventy Preact Islands Demo

## Hydration
The component below was rendered at build time, then hydrated at runtime.
{% renderComponent "./Counter" %}

## Client-only
The component below was bundled at build time and rendered at runtime.
{% renderClientComponent "./Counter" %}

## Static
The component below was rendered at build time and no JS was sent to the client.
{% renderStaticComponent "./Counter" %}
