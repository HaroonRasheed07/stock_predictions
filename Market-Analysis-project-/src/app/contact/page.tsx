import type { Metadata } from 'next';
import Link from 'next/link';
import { Github, Linkedin, Mail } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'Contact StockVantex' },
  description: `Get in touch with ${SITE_NAME}. Reach out via email or connect on LinkedIn and GitHub.`,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    images: ['/icon-512.png'],
    title: `Contact | ${SITE_NAME}`,
    description: `Get in touch with ${SITE_NAME}.`,
    url: `${SITE_URL}/contact`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-24 max-w-4xl">
      <div className="space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Contact StockVantex</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Have questions, feedback, or want to collaborate? Feel free to reach out via email or connect on social media.
        </p>

        <div className="grid gap-8 md:grid-cols-3 mt-12">
          <a
            href="mailto:haroon@stockvantex.com"
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50 transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Mail className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">Email</h3>
            <p className="text-sm text-muted-foreground text-center">
              haroon@stockvantex.com
            </p>
          </a>

          <a
            href="https://www.linkedin.com/in/haroon-rasheed-55022427a"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50 transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Linkedin className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">LinkedIn</h3>
            <p className="text-sm text-muted-foreground text-center">
              Haroon Rasheed
            </p>
          </a>

          <a
            href="https://github.com/HaroonRasheed07"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50 transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Github className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">GitHub</h3>
            <p className="text-sm text-muted-foreground text-center">
              @HaroonRasheed07
            </p>
          </a>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/30 p-6 text-left">
          <h2 className="text-lg font-semibold mb-2">Report a factual correction</h2>
          <p className="text-sm text-muted-foreground">
            Email{' '}
            <a className="text-primary hover:underline" href="mailto:haroon@stockvantex.com?subject=Correction%20request">
              haroon@stockvantex.com
            </a>{' '}
            with the subject <strong>Correction request</strong>. Include the page URL, the exact claim,
            your evidence and the date observed. Our ownership, evidence and correction policy is on the{' '}
            <Link href="/editorial-standards" className="text-primary hover:underline">
              Editorial Standards
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
    </div>
  );
}
