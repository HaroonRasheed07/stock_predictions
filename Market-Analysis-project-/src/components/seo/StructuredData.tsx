export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Stock Vanta',
          url: 'https://stockvanta.vercel.app',
          logo: 'https://stockvanta.vercel.app/logo.png',
          description: 'AI-powered stock research and decision intelligence.',
        }),
      }}
    />
  );
}

export function WebsiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Stock Vanta',
          url: 'https://stockvanta.vercel.app',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://stockvanta.vercel.app/stocks?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; url: string }> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: item.url,
          })),
        }),
      }}
    />
  );
}
